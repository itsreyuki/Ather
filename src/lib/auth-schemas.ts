import { z } from "zod";

const password = z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(128);
const contact = z.object({ email: z.string().email().optional(), phone: z.string().min(7).optional() }).refine((value) => Boolean(value.email) !== Boolean(value.phone), { message: "اختر بريدًا إلكترونيًا أو رقم جوال واحدًا" });

export const registerSchema = contact.extend({ password, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { message: "كلمتا المرور غير متطابقتين", path: ["confirmPassword"] });
export const loginSchema = z.object({ identity: z.string().min(3), password });

export const schoolOnboardingSchema = z.object({
  officialName: z.string().trim().min(2).max(180),
  ministryCode: z.string().trim().min(2).max(60),
  educationAdministration: z.string().trim().min(2).max(120),
  educationOffice: z.string().trim().max(120).optional(),
  region: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  educationStage: z.string().trim().min(2).max(80),
  schoolType: z.enum(["GOVERNMENT", "PRIVATE", "OTHER"]),
  genderType: z.enum(["BOYS", "GIRLS", "OTHER"]),
  principalName: z.string().trim().min(2).max(120),
  officialPhone: z.string().trim().max(30).optional(),
});
