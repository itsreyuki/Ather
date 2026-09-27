import { LicenseCodeStatus } from "@prisma/client";
import { LANDING_CONFIG } from "@/src/config/landing";
import { db } from "./db";

export async function getLaunchAvailability() {
  const redeemed = await db.licenseCode.count({ where: { status: LicenseCodeStatus.REDEEMED } });
  return { totalSlots: LANDING_CONFIG.totalSlots, availableSlots: Math.max(0, LANDING_CONFIG.totalSlots - redeemed), redeemedSlots: redeemed, launchPrice: LANDING_CONFIG.launchPrice };
}
