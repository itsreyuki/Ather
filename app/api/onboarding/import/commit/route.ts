import { NextResponse } from "next/server";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { encryptField, phoneLookupHash } from "@/src/lib/security";
import { staffOverrideFields } from "@/src/lib/staff-overrides";
import { analyzeStaffWorkbook, readStaffImportFile, type StaffCorrections, type StaffMapping } from "@/src/lib/staff-import";
import { createInAppNotification, notificationTypes } from "@/src/lib/notification-service";
import { Permission } from "@/src/lib/permissions";

export const runtime = "nodejs";

function parseCorrections(value: FormDataEntryValue | null): StaffCorrections | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("تصحيحات الملف غير صالحة");
  return parsed as StaffCorrections;
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  if (!session.membership) return NextResponse.json({ error: "أكمل إعداد المدرسة أولًا" }, { status: 409 });
  const denied = assertApiPermission(session, Permission.StaffWrite);
  if (denied) return denied;
  try {
    const activeWorkshop = await db.workshop.findFirst({
      where: {
        schoolId: session.membership.schoolId,
        deletedAt: null,
        finalizedAt: { not: null },
        cancelledAt: null,
        postAssessmentSubmittedAt: null,
      },
      select: { id: true, title: true },
    });
    if (activeWorkshop)
      return NextResponse.json(
        {
          error:
            "لا يمكن تحديث قائمة المنسوبين أثناء وجود ورشة فعالة أو قياس بعدي مفتوح. أكمل القياس أو ألغِ الورشة أولًا.",
        },
        { status: 409 },
      );
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 });
    const mapping = form.get("mapping")
      ? (JSON.parse(String(form.get("mapping"))) as StaffMapping)
      : undefined;
    const corrections = parseCorrections(form.get("corrections"));
    const stored = await readStaffImportFile(file);
    const existing = await db.staffMember.findMany({
      where: { schoolId: session.membership.schoolId },
      select: {
        id: true,
        fullName: true,
        nationalIdLast4: true,
        nationalIdHash: true,
        phoneLookupHash: true,
        active: true,
        manualOverrideFields: true,
      },
    });
    const analysis = await analyzeStaffWorkbook({
      ...stored,
      mapping,
      corrections,
      existingIdHashes: new Set(existing.map((item) => item.nationalIdHash)),
      existingPhoneHashes: new Set(
        existing.flatMap((item) => (item.phoneLookupHash ? [item.phoneLookupHash] : [])),
      ),
    });
    if (!analysis.noorTemplate.matches)
      return NextResponse.json(
        {
          error:
            "الملف لا يطابق قالب قائمة المنسوبين الرسمي من نظام نور. حمّل تقرير PDF الرسمي من نور كما هو، أو راجع مثال الأعمدة الظاهر في شاشة الاستيراد.",
          template: analysis.noorTemplate,
        },
        { status: 422 },
      );
    if (analysis.needsMapping)
      return NextResponse.json({ error: "يلزم تأكيد مطابقة الأعمدة قبل الاعتماد" }, { status: 422 });
    const validRows = analysis.rows.filter((row) => row.errors.length === 0 && row.nationalIdHash);
    if (analysis.invalidRows > 0)
      return NextResponse.json({ error: "توجد سجلات غير سليمة. صحح أسباب الخلل في المعاينة ثم أعد التحليل قبل الحفظ." }, { status: 422 });
    if (!validRows.length)
      return NextResponse.json({ error: "لا توجد سجلات سليمة قابلة للاستيراد" }, { status: 422 });
    const incomingHashes = new Set(validRows.map((row) => row.nationalIdHash));
    const missingStaff = existing.filter(
      (staff) => staff.active && !incomingHashes.has(staff.nationalIdHash),
    );
    const missingFromLatest = missingStaff.map((staff) => staff.id);
    const diff = {
      created: validRows
        .filter((row) => !row.duplicateInSchool)
        .map((row) => ({ fullName: row.fullName, rowNumber: row.rowNumber })),
      updated: validRows
        .filter((row) => row.duplicateInSchool)
        .map((row) => ({ fullName: row.fullName, rowNumber: row.rowNumber })),
      conflicts: analysis.rows
        .filter((row) => row.errors.length > 0)
        .map((row) => ({
          fullName: row.fullName || "بدون اسم",
          rowNumber: row.rowNumber,
          issues: row.errors,
        })),
      missing: missingStaff.map((staff) => ({
        id: staff.id,
        fullName: staff.fullName,
        nationalIdLast4: staff.nationalIdLast4,
      })),
    };
    const result = await db.$transaction(async (tx) => {
      // Serialize roster changes with workshop state transitions for this school.
      await tx.school.update({
        where: { id: session.membership!.schoolId },
        data: { updatedAt: new Date() },
      });
      const activeInsideTransaction = await tx.workshop.findFirst({
        where: {
          schoolId: session.membership!.schoolId,
          finalizedAt: { not: null },
          cancelledAt: null,
          postAssessmentSubmittedAt: null,
        },
        select: { id: true },
      });
      if (activeInsideTransaction) throw new Error("ACTIVE_WORKSHOP_IMPORT_BLOCKED");
      let created = 0;
      let updated = 0;
      const currentStaff = await tx.staffMember.findMany({
        where: { schoolId: session.membership!.schoolId },
        select: { id: true, nationalIdHash: true, manualOverrideFields: true },
      });
      const existingByHash = new Map(currentStaff.map((staff) => [staff.nationalIdHash, staff]));
      const fieldsToClear = ["fullName", "jobTitle", "specialization", "email", "employeeNumber", "phone"];
      const importedFields = fieldsToClear.filter(
        (field) => analysis.mapping[field as keyof typeof analysis.mapping],
      );
      const newRows = validRows.filter((row) => !existingByHash.has(row.nationalIdHash));
      if (newRows.length) {
        const inserted = await tx.staffMember.createMany({
          data: newRows.map((row) => ({
            schoolId: session.membership!.schoolId,
            nationalIdHash: row.nationalIdHash,
            nationalIdLast4: row.nationalIdLast4,
            phoneEncrypted: row.phone ? encryptField(row.phone) : undefined,
            phoneLookupHash: row.phone ? phoneLookupHash(row.phone) : undefined,
            phoneLast4: row.phoneLast4 ?? undefined,
            fullName: row.fullName,
            jobTitle: row.jobTitle ?? undefined,
            specialization: row.specialization ?? undefined,
            email: row.email ?? undefined,
            employeeNumber: row.employeeNumber ?? undefined,
            source: "NOOR_IMPORT",
            active: true,
          })),
        });
        created = inserted.count;
      }
      for (const row of validRows.filter((item) => existingByHash.has(item.nationalIdHash))) {
        const current = existingByHash.get(row.nationalIdHash)!;
        const updateData: Record<string, unknown> = {
          active: true,
          ...(analysis.mapping.fullName ? { fullName: row.fullName } : {}),
          ...(analysis.mapping.jobTitle && row.jobTitle ? { jobTitle: row.jobTitle } : {}),
          ...(analysis.mapping.specialization && row.specialization
            ? { specialization: row.specialization }
            : {}),
          ...(analysis.mapping.email && row.email ? { email: row.email } : {}),
          ...(analysis.mapping.employeeNumber && row.employeeNumber
            ? { employeeNumber: row.employeeNumber }
            : {}),
          ...(analysis.mapping.phone && row.phone
            ? {
                phoneEncrypted: encryptField(row.phone),
                phoneLookupHash: phoneLookupHash(row.phone),
                phoneLast4: row.phoneLast4,
              }
            : {}),
          manualOverrideFields: staffOverrideFields(current.manualOverrideFields).filter((field) => !importedFields.includes(field)),
        };
        await tx.staffMember.update({ where: { id: current.id }, data: updateData });
        updated += 1;
      }
      const batch = await tx.staffImportBatch.create({
        data: {
          schoolId: session.membership!.schoolId,
          fileName: stored.fileName,
          source: "NOOR_IMPORT",
          status: "COMMITTED",
          rowCount: analysis.totalRows,
          successCount: validRows.length,
          errorCount: analysis.invalidRows,
          duplicateCount: analysis.duplicateRows,
          invalidCount: analysis.invalidRows,
          missingCount: missingFromLatest.length,
          reviewCount: analysis.reviewRows + missingFromLatest.length,
          diff: { ...diff, missingStaffIds: missingFromLatest, createdCount: created, updatedCount: updated },
          completedAt: new Date(),
        },
      });
      await tx.school.update({
        where: { id: session.membership!.schoolId },
        data: { setupStatus: "ACTIVE" },
      });
      await tx.auditLog.create({
        data: {
          schoolId: session.membership!.schoolId,
          userId: session.user.id,
          action: existing.length ? "STAFF_REIMPORT_COMMITTED" : "STAFF_IMPORT_COMMITTED",
          entity: "StaffImportBatch",
          entityId: batch.id,
          metadata: {
            totalRows: analysis.totalRows,
            imported: validRows.length,
            created,
            updated,
            missingFromLatest: missingFromLatest.length,
            reviewRows: analysis.reviewRows,
            reimport: existing.length > 0,
          },
        },
      });
      return { batch, created, updated, missingFromLatest: missingFromLatest.length };
    });
    await createInAppNotification({
      schoolId: session.membership.schoolId,
      type: notificationTypes.STAFF_IMPORT_SUCCESS,
      title: "نجح استيراد المنسوبين",
      body: `تمت معالجة ${validRows.length.toLocaleString("ar-SA")} منسوبًا من ملف نور.`,
      href: "/dashboard/staff",
      entityId: result.batch.id,
      dedupeKey: `import:${result.batch.id}:success`,
    });
    const reviewCount = analysis.invalidRows + analysis.reviewRows + result.missingFromLatest;
    if (reviewCount > 0)
      await createInAppNotification({
        schoolId: session.membership.schoolId,
        type: notificationTypes.STAFF_IMPORT_REVIEW,
        title: "الاستيراد يحتاج مراجعة",
        body: `توجد ${reviewCount.toLocaleString("ar-SA")} سجلات تحتاج مراجعة في آخر استيراد.`,
        href: "/dashboard/staff/import",
        entityId: result.batch.id,
        dedupeKey: `import:${result.batch.id}:review`,
        metadata: { reviewCount },
      });
    return NextResponse.json(
      {
        batchId: result.batch.id,
        imported: validRows.length,
        created: result.created,
        updated: result.updated,
        missingFromLatest: result.missingFromLatest,
        missingStaff: diff.missing,
        conflicts: diff.conflicts,
        createdRows: diff.created,
        updatedRows: diff.updated,
        needsPhone: validRows.filter((row) => !row.phone).length,
        needsReview: analysis.invalidRows + analysis.reviewRows + result.missingFromLatest,
        nextPath: "/dashboard",
      },
      { status: 201 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          code === "ACTIVE_WORKSHOP_IMPORT_BLOCKED"
            ? "لا يمكن تحديث قائمة المنسوبين أثناء وجود ورشة فعالة أو قياس بعدي مفتوح."
            : code || "تعذر اعتماد الاستيراد",
      },
      { status: code === "ACTIVE_WORKSHOP_IMPORT_BLOCKED" ? 409 : 400 },
    );
  }
}
