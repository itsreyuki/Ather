import { LicenseCodeStatus } from "@prisma/client";
import { db } from "./db";
import { generateLicenseCode, licenseCodeHash } from "./license";
import { LANDING_CONFIG } from "@/src/config/landing";

const activityLabels: Record<string, string> = {
  SCHOOL_CREATED: "أنشأت مدرسة حسابًا جديدًا",
  STAFF_IMPORT_COMMITTED: "استوردت مدرسة قائمة المنسوبين",
  STAFF_IMPORT_REIMPORT_COMMITTED: "حدّثت مدرسة قائمة المنسوبين",
  WORKSHOP_CREATED: "أضافت مدرسة ورشة جديدة",
  WORKSHOP_FINALIZED: "اعتمدت مدرسة ورشة",
  WORKSHOP_CANCELLED: "ألغت مدرسة ورشة",
  PROFESSIONAL_GROWTH_PLAN_CREATED: "أنشأت مدرسة خطة نمو مهني",
  PROFESSIONAL_GROWTH_PLAN_FINALIZED: "اعتمدت مدرسة خطة نمو مهني",
  REPORT_GENERATED: "أنشأت مدرسة تقريرًا",
  REPORT_EXPORT: "صدّرت مدرسة تقريرًا",
};

export async function getAdminOverview() {
  const [schools, activeSchools, users, staff, workshops, completedReports, redeemedLicenses, totalLicenses, activities, licenses] = await Promise.all([
    db.school.count(),
    db.school.count({ where: { setupStatus: "ACTIVE" } }),
    db.user.count(),
    db.staffMember.count(),
    db.workshop.count({ where: { deletedAt: null } }),
    db.reportSnapshot.count(),
    db.licenseCode.count({ where: { status: LicenseCodeStatus.REDEEMED } }),
    db.licenseCode.count(),
    db.auditLog.findMany({ where: { schoolId: { not: null } }, orderBy: { createdAt: "desc" }, take: 20, select: { action: true, createdAt: true } }),
    db.licenseCode.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, codeLast4: true, label: true, status: true, createdAt: true, redeemedAt: true } }),
  ]);
  return {
    stats: { schools, activeSchools, users, staff, workshops, completedReports },
    licenses: { total: LANDING_CONFIG.totalSlots, created: totalLicenses, redeemed: redeemedLicenses, available: Math.max(0, LANDING_CONFIG.totalSlots - redeemedLicenses), items: licenses },
    activities: activities.map((item) => ({ label: activityLabels[item.action] ?? "نشاط تشغيلي في مدرسة", createdAt: item.createdAt })),
  };
}

export async function createLicenseCodes(quantity: number, label?: string) {
  const amount = Math.min(10, Math.max(1, Math.floor(quantity)));
  return db.$transaction(async (tx) => {
    const redeemed = await tx.licenseCode.count({ where: { status: LicenseCodeStatus.REDEEMED } });
    if (redeemed + amount > LANDING_CONFIG.totalSlots) throw new Error("LICENSE_CAPACITY_REACHED");
    const created: Array<{ id: string; code: string; label: string | null }> = [];
    for (let index = 0; index < amount; index += 1) {
      let code = generateLicenseCode();
      while (await tx.licenseCode.findUnique({ where: { codeHash: licenseCodeHash(code) }, select: { id: true } })) code = generateLicenseCode();
      const item = await tx.licenseCode.create({ data: { codeHash: licenseCodeHash(code), codeLast4: code.slice(-4), label: label?.trim() || null }, select: { id: true, label: true } });
      created.push({ ...item, code });
    }
    return created;
  });
}

export async function revokeLicenseCode(id: string) {
  const updated = await db.licenseCode.updateMany({ where: { id, status: LicenseCodeStatus.ACTIVE, redeemedAt: null }, data: { status: LicenseCodeStatus.REVOKED } });
  if (!updated.count) throw new Error("LICENSE_NOT_ACTIVE");
}
