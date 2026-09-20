import { createHash } from "node:crypto";
import { db } from "./db";
import { serverNow } from "./clock";
import type { DashboardAttentionItem } from "./dashboard-attention-types";

const activeWorkshopStatuses = ["SCHEDULED", "IN_PROGRESS", "POST_ASSESSMENT_AVAILABLE"] as const;

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(value);
}

function actionLabel(action: string) {
  if (action === "DASHBOARD_ALERT_DISMISSED") return "إخفاء تنبيه من لوحة المؤشرات";
  const labels: Record<string, string> = {
    SCHOOL_CREATED: "إنشاء المدرسة",
    STAFF_IMPORT_COMMITTED: "استيراد المنسوبين",
    STAFF_REIMPORT_COMMITTED: "إعادة استيراد المنسوبين",
    STAFF_MARKED_INACTIVE_AFTER_IMPORT_DIFF: "تعطيل منسوبين بعد إعادة الاستيراد",
    STAFF_MANUALLY_UPDATED: "تصحيح بيانات منسوب",
    STAFF_IDENTITY_CORRECTED: "تصحيح رقم هوية",
    WORKSHOP_CREATED: "إنشاء ورشة",
    WORKSHOP_DUPLICATED: "استخدام ورشة سابقة كورشة جديدة",
    WORKSHOP_TEMPLATE_CREATED: "حفظ قالب ورشة",
    TEAM_INVITATION_CREATED: "إرسال دعوة مسؤول مدرسة",
    TEAM_INVITATION_ACCEPTED: "قبول دعوة مسؤول مدرسة",
    TEAM_INVITATION_REVOKED: "إلغاء دعوة مسؤول مدرسة",
    TEAM_MEMBER_SUSPENDED: "إيقاف مسؤول مدرسة",
    TEAM_MEMBER_REACTIVATED: "إعادة تفعيل مسؤول مدرسة",
    SCHOOL_UPDATED: "تغيير بيانات المدرسة",
    STAFF_PHONE_CORRECTED: "تصحيح رقم جوال",
    WORKSHOP_FINALIZED: "اعتماد ورشة",
    WORKSHOP_CANCELLED: "إلغاء ورشة",
    PRE_ASSESSMENT_SUBMITTED: "إرسال التقييم القبلي",
    POST_ASSESSMENT_SUBMITTED: "إرسال التقييم البعدي",
    REPORT_GENERATED: "إصدار تقرير",
    LOGIN_SUCCESS: "تسجيل دخول ناجح",
    LOGIN_FAILED: "محاولة دخول فاشلة",
    LOGOUT: "تسجيل خروج",
    PRIVACY_RETENTION_SETTINGS_UPDATED: "تغيير سياسة الاحتفاظ",
    ASSESSMENT_COMPLETED: "اكتمال قياس",
  };
  return labels[action] ?? "نشاط على المنصة";
}

export async function getDashboardData(schoolId: string) {
  const now = serverNow();
  const [
    activeStaff,
    activeWorkshops,
    pendingPostAssessments,
    completedWorkshops,
    phonelessStaffRows,
    latestImport,
    postReadyWorkshops,
    draftWorkshops,
    audits,
    workshopList,
  ] = await Promise.all([
    db.staffMember.count({ where: { schoolId, active: true } }),
    db.workshop.count({ where: { schoolId, deletedAt: null, status: { in: [...activeWorkshopStatuses] } } }),
    db.managerAssessment.count({
      where: { phase: "POST", status: "DRAFT", workshop: { schoolId, deletedAt: null, finalizedAt: { not: null }, cancelledAt: null, postAssessmentSubmittedAt: null, endsAt: { lte: now } } },
    }),
    db.workshop.count({ where: { schoolId, deletedAt: null, status: "COMPLETED" } }),
    db.staffMember.findMany({
      where: { schoolId, active: true, phoneEncrypted: null },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    db.staffImportBatch.findFirst({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      select: { id: true, errorCount: true, invalidCount: true, reviewCount: true, createdAt: true },
    }),
    db.workshop.findMany({
      where: { schoolId, deletedAt: null, finalizedAt: { not: null }, cancelledAt: null, postAssessmentSubmittedAt: null, startsAt: { not: null }, endsAt: { lte: now } },
      orderBy: { endsAt: "asc" },
      take: 5,
      select: { id: true, title: true, endsAt: true },
    }),
    db.workshop.findMany({
      where: { schoolId, deletedAt: null, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, updatedAt: true, draftStep: true },
    }),
    db.auditLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, entityId: true, createdAt: true },
    }),
    db.workshop.findMany({
      where: { schoolId, deletedAt: null, status: { in: [...activeWorkshopStatuses] } },
      orderBy: { startsAt: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        endsAt: true,
        _count: { select: { participants: true } },
      },
    }),
  ]);

  const completed = await db.reportSnapshot.findMany({
    where: { schoolId, workshop: { schoolId, deletedAt: null, status: "COMPLETED" } },
    select: { overallScaleImprovement: true },
  });
  const impactValues = completed.flatMap((report) =>
    report.overallScaleImprovement === null ? [] : [report.overallScaleImprovement],
  );

  const latestActivities = audits.map((item) => ({
    id: item.id,
    label: actionLabel(item.action),
    date: dateLabel(item.createdAt),
    entityId: item.entityId,
  }));
  const drafts = draftWorkshops.map((draft) => ({
    ...draft,
    completionPercentage: Math.min(100, Math.round((draft.draftStep / 5) * 100)),
    stageLabel:
      [
        "معلومات الورشة",
        "المشاركون",
        "معايير الأثر",
        "التقييم القبلي",
        "المراجعة والاعتماد",
        "جاهزة للاعتماد",
      ][Math.min(draft.draftStep, 5)] ?? "إعداد الورشة",
  }));

  const phonelessStaff = phonelessStaffRows.length;
  const phonelessStaffFingerprint = createHash("sha256")
    .update(phonelessStaffRows.map((staff) => staff.id).join("|"))
    .digest("hex");
  const currentAttention: DashboardAttentionItem[] = [
    ...postReadyWorkshops.map((workshop) => ({
      key: `post-assessment:${workshop.id}`,
      fingerprint: `post-assessment:${workshop.id}:POST_ASSESSMENT_AVAILABLE`,
      kind: "POST_ASSESSMENT" as const,
      tone: "warning" as const,
      title: "التقييم البعدي جاهز",
      description: `${workshop.title} — راجع التقييمات ثم اعتمدها لإكمال القياس.`,
      href: `/dashboard/workshops/${workshop.id}`,
      statusLabel: "إجراء مطلوب",
    })),
    ...(phonelessStaff > 0
      ? [{
          key: "phoneless-staff",
          fingerprint: `phoneless-staff:${phonelessStaffFingerprint}`,
          kind: "PHONELESS_STAFF" as const,
          tone: "info" as const,
          title: "موظفون بدون رقم جوال",
          description: `${numberLabel(phonelessStaff)} منسوبين لا يمكنهم استخدام الدخول الذاتي حتى تُستكمل بياناتهم.`,
          href: "/dashboard/staff?phone=missing",
          statusLabel: "مراجعة",
        }]
      : []),
    ...(latestImport &&
    (latestImport.errorCount > 0 || latestImport.invalidCount > 0 || latestImport.reviewCount > 0)
      ? [{
          key: "import-review",
          fingerprint: `import-review:${latestImport.id}:${latestImport.errorCount}:${latestImport.invalidCount}:${latestImport.reviewCount}`,
          kind: "IMPORT_REVIEW" as const,
          tone: "error" as const,
          title: "آخر استيراد يحتاج مراجعة",
          description: `راجع ${numberLabel(latestImport.errorCount + latestImport.invalidCount + latestImport.reviewCount)} سجلات قبل الاعتماد أو إعادة الاستيراد.`,
          href: "/dashboard/staff/import",
          statusLabel: "فتح الاستيراد",
        }]
      : []),
    ...drafts.map((draft) => ({
      key: `draft-workshop:${draft.id}`,
      fingerprint: `draft-workshop:${draft.id}:step-${draft.draftStep}`,
      kind: "DRAFT_WORKSHOP" as const,
      tone: "neutral" as const,
      title: "مسودة ورشة غير مكتملة",
      description: `${draft.title} — آخر مرحلة: ${draft.stageLabel}.`,
      href: `/dashboard/workshops/new?id=${draft.id}`,
      statusLabel: "استكمال",
    })),
  ];
  const dismissals = await db.dashboardAlertDismissal.findMany({ where: { schoolId }, select: { id: true, alertKey: true, fingerprint: true } });
  const currentKeys = new Set(currentAttention.map((item) => `${item.key}:${item.fingerprint}`));
  const staleDismissalIds = dismissals.filter((item) => !currentKeys.has(`${item.alertKey}:${item.fingerprint}`)).map((item) => item.id);
  if (staleDismissalIds.length) await db.dashboardAlertDismissal.deleteMany({ where: { id: { in: staleDismissalIds } } });
  const dismissedKeys = new Set(dismissals.map((item) => `${item.alertKey}:${item.fingerprint}`));
  const attention = currentAttention.filter((item) => !dismissedKeys.has(`${item.key}:${item.fingerprint}`));
  return {
    stats: {
      activeStaff,
      activeWorkshops,
      pendingPostAssessments,
      completedWorkshops,
      averageImpact: impactValues.length
        ? impactValues.reduce((sum, value) => sum + value, 0) / impactValues.length
        : null,
    },
    attention,
    drafts,
    latestActivities,
    workshops: workshopList,
  };
}

function numberLabel(value: number) {
  return value.toLocaleString("ar-SA");
}

/**
 * Re-checks a dismissal against the live cause. The client can never dismiss
 * an arbitrary alert or manufacture a permanent suppression record.
 */
export async function isCurrentDashboardAttention(schoolId: string, alertKey: string, fingerprint: string) {
  if (alertKey.startsWith("post-assessment:")) {
    const workshopId = alertKey.slice("post-assessment:".length);
    const workshop = await db.workshop.findFirst({ where: { id: workshopId, schoolId, deletedAt: null, finalizedAt: { not: null }, cancelledAt: null, postAssessmentSubmittedAt: null, startsAt: { not: null }, endsAt: { lte: serverNow() } }, select: { id: true } });
    return Boolean(workshop) && fingerprint === `${alertKey}:POST_ASSESSMENT_AVAILABLE`;
  }

  if (alertKey === "phoneless-staff") {
    const rows = await db.staffMember.findMany({ where: { schoolId, active: true, phoneEncrypted: null }, select: { id: true }, orderBy: { id: "asc" } });
    const currentFingerprint = `phoneless-staff:${createHash("sha256").update(rows.map((staff) => staff.id).join("|")).digest("hex")}`;
    return rows.length > 0 && fingerprint === currentFingerprint;
  }

  if (alertKey === "import-review") {
    const parts = fingerprint.split(":");
    const [prefix, batchId, errorCount, invalidCount, reviewCount] = parts;
    if (prefix !== "import-review" || !batchId || !/^[0-9]+$/.test(errorCount ?? "") || !/^[0-9]+$/.test(invalidCount ?? "") || !/^[0-9]+$/.test(reviewCount ?? "")) return false;
    const latest = await db.staffImportBatch.findFirst({ where: { schoolId }, orderBy: { createdAt: "desc" }, select: { id: true, errorCount: true, invalidCount: true, reviewCount: true } });
    return Boolean(latest && latest.id === batchId && latest.errorCount === Number(errorCount) && latest.invalidCount === Number(invalidCount) && latest.reviewCount === Number(reviewCount) && (latest.errorCount > 0 || latest.invalidCount > 0 || latest.reviewCount > 0));
  }

  if (alertKey.startsWith("draft-workshop:")) {
    const workshopId = alertKey.slice("draft-workshop:".length);
    const match = /^draft-workshop:[^:]+:step-([0-9]+)$/.exec(fingerprint);
    if (!match) return false;
    const workshop = await db.workshop.findFirst({ where: { id: workshopId, schoolId, deletedAt: null, status: "DRAFT" }, select: { draftStep: true } });
    return Boolean(workshop && workshop.draftStep === Number(match[1]));
  }

  return false;
}
