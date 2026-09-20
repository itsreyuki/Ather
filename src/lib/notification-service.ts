import { Prisma } from "@prisma/client";
import { getWorkshopEffectiveState } from "./workshop";
import { db } from "./db";

export const notificationTypes = {
  UPCOMING_WORKSHOP: "UPCOMING_WORKSHOP",
  WORKSHOP_STARTED: "WORKSHOP_STARTED",
  POST_ASSESSMENT_AVAILABLE: "POST_ASSESSMENT_AVAILABLE",
  POST_ASSESSMENT_INCOMPLETE: "POST_ASSESSMENT_INCOMPLETE",
  LOW_TEACHER_RESPONSE: "LOW_TEACHER_RESPONSE",
  STAFF_IMPORT_SUCCESS: "STAFF_IMPORT_SUCCESS",
  STAFF_IMPORT_REVIEW: "STAFF_IMPORT_REVIEW",
} as const;

export type NotificationType = (typeof notificationTypes)[keyof typeof notificationTypes];

type NotificationInput = { schoolId: string; type: NotificationType; title: string; body: string; href?: string; entityId?: string; dedupeKey: string; metadata?: Record<string, string | number | boolean | null> };

export async function createInAppNotification(input: NotificationInput) {
  const existing = await db.notification.findFirst({ where: { schoolId: input.schoolId, dedupeKey: input.dedupeKey } });
  if (existing) return existing;
  try { return await db.notification.create({ data: { schoolId: input.schoolId, type: input.type, title: input.title, body: input.body, href: input.href, entityId: input.entityId, dedupeKey: input.dedupeKey, metadata: input.metadata } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return db.notification.findFirstOrThrow({ where: { schoolId: input.schoolId, dedupeKey: input.dedupeKey } }); throw error; }
}

async function syncWorkshopNotifications(schoolId: string, now: Date) {
  const workshops = await db.workshop.findMany({
    where: { schoolId, deletedAt: null, finalizedAt: { not: null }, cancelledAt: null, startsAt: { not: null }, endsAt: { not: null } },
    select: { id: true, title: true, startsAt: true, endsAt: true, finalizedAt: true, cancelledAt: true, postAssessmentSubmittedAt: true, participants: { select: { id: true } }, criteria: { select: { id: true } }, assessments: { where: { phase: "POST" }, select: { status: true } }, evaluations: { where: { status: "SUBMITTED" }, select: { id: true } } },
  });

  for (const workshop of workshops) {
    const state = getWorkshopEffectiveState(workshop, now);
    const startAt = workshop.startsAt!;
    const endAt = workshop.endsAt!;
    const withinNextTwoDays = startAt.getTime() > now.getTime() && startAt.getTime() - now.getTime() <= 48 * 60 * 60 * 1000;
    const expectedPost = workshop.participants.length * workshop.criteria.length;
    const postCompleted = workshop.assessments.filter((assessment) => assessment.status === "SUBMITTED").length;
    const responseRate = workshop.participants.length ? workshop.evaluations.length / workshop.participants.length * 100 : 100;
    const midpoint = startAt.getTime() + (endAt.getTime() - startAt.getTime()) / 2;

    if (state === "SCHEDULED" && withinNextTwoDays) await createInAppNotification({ schoolId, type: notificationTypes.UPCOMING_WORKSHOP, title: "موعد ورشة قريب", body: `تبدأ ورشة «${workshop.title}» خلال يومين أو أقل.`, href: `/dashboard/workshops/${workshop.id}`, entityId: workshop.id, dedupeKey: `workshop:${workshop.id}:upcoming` });
    if (state === "IN_PROGRESS") await createInAppNotification({ schoolId, type: notificationTypes.WORKSHOP_STARTED, title: "بدأت الورشة", body: `بدأت ورشة «${workshop.title}» ويمكن متابعة تقدمها من لوحة الورشة.`, href: `/dashboard/workshops/${workshop.id}`, entityId: workshop.id, dedupeKey: `workshop:${workshop.id}:started` });
    if (state === "POST_ASSESSMENT_AVAILABLE") {
      await createInAppNotification({ schoolId, type: notificationTypes.POST_ASSESSMENT_AVAILABLE, title: "التقييم البعدي متاح", body: `انتهت ورشة «${workshop.title}» وأصبح التقييم البعدي جاهزًا.`, href: `/dashboard/workshops/${workshop.id}#post-assessment`, entityId: workshop.id, dedupeKey: `workshop:${workshop.id}:post-available` });
      if (expectedPost > postCompleted) await createInAppNotification({ schoolId, type: notificationTypes.POST_ASSESSMENT_INCOMPLETE, title: "التقييم البعدي غير مكتمل", body: `اكتمل ${postCompleted.toLocaleString("ar-SA")} من أصل ${expectedPost.toLocaleString("ar-SA")} تقييمًا بعديًا لورشة «${workshop.title}».`, href: `/dashboard/workshops/${workshop.id}#post-assessment`, entityId: workshop.id, dedupeKey: `workshop:${workshop.id}:post-incomplete`, metadata: { completed: postCompleted, expected: expectedPost } });
    }
    if (state === "IN_PROGRESS" && now.getTime() >= midpoint && responseRate < 50) await createInAppNotification({ schoolId, type: notificationTypes.LOW_TEACHER_RESPONSE, title: "انخفاض استجابة المتدربين", body: `أكمل ${workshop.evaluations.length.toLocaleString("ar-SA")} من أصل ${workshop.participants.length.toLocaleString("ar-SA")} تقييمًا لورشة «${workshop.title}».`, href: `/dashboard/workshops/${workshop.id}`, entityId: workshop.id, dedupeKey: `workshop:${workshop.id}:low-response`, metadata: { completed: workshop.evaluations.length, expected: workshop.participants.length } });
  }
}

async function syncImportNotifications(schoolId: string) {
  const imports = await db.staffImportBatch.findMany({ where: { schoolId, status: "COMMITTED" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, successCount: true, reviewCount: true, createdAt: true } });
  for (const batch of imports) {
    await createInAppNotification({ schoolId, type: notificationTypes.STAFF_IMPORT_SUCCESS, title: "نجح استيراد المنسوبين", body: `تمت معالجة ${batch.successCount.toLocaleString("ar-SA")} منسوبًا من ملف نور.`, href: "/dashboard/staff", entityId: batch.id, dedupeKey: `import:${batch.id}:success` });
    if (batch.reviewCount > 0) await createInAppNotification({ schoolId, type: notificationTypes.STAFF_IMPORT_REVIEW, title: "الاستيراد يحتاج مراجعة", body: `توجد ${batch.reviewCount.toLocaleString("ar-SA")} سجلات تحتاج مراجعة في آخر استيراد.`, href: "/dashboard/staff/import", entityId: batch.id, dedupeKey: `import:${batch.id}:review`, metadata: { reviewCount: batch.reviewCount } });
  }
}

export async function syncSchoolNotifications(schoolId: string, now = new Date()) {
  await Promise.all([syncWorkshopNotifications(schoolId, now), syncImportNotifications(schoolId)]);
}

export async function getNotificationCenter(schoolId: string, limit = 30) {
  await syncSchoolNotifications(schoolId);
  const [items, unreadCount] = await Promise.all([db.notification.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true } }), db.notification.count({ where: { schoolId, readAt: null } })]);
  return { items, unreadCount };
}

export async function markNotificationRead(schoolId: string, notificationId: string) { return db.notification.updateMany({ where: { id: notificationId, schoolId, readAt: null }, data: { readAt: new Date() } }); }
export async function markAllNotificationsRead(schoolId: string) { return db.notification.updateMany({ where: { schoolId, readAt: null }, data: { readAt: new Date() } }); }
