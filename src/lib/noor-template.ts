/**
 * The attached Noor PDF is used as a format reference only.  Real staff
 * records are never bundled with the application.  These are the visible
 * column labels extracted from that report, with the common variations that
 * Noor exports use over time.
 */
export const NOOR_ROSTER_TEMPLATE = {
  name: "قائمة المنسوبين الرسمية من نظام نور",
  source: "NOOR_OFFICIAL_ROSTER_PDF",
  expectedColumns: [
    "اسم المستخدم",
    "الاسم الرباعي",
    "الجوال",
    "حالة التوظيف",
    "المسمى الوظيفي",
    "مجال التدريس",
    "التخصص",
  ],
  sampleRow: [
    "1234567890",
    "أحمد محمد (مثال)",
    "0500000000",
    "دائم",
    "معلم (مثال)",
    "الحاسب",
    "تقنية المعلومات",
  ],
} as const;

export const NOOR_TEMPLATE_ALIASES = {
  nationalId: ["رقم الهوية", "الهوية الوطنية", "رقم السجل المدني", "السجل المدني", "رقم هويه", "الهوية", "اسم المستخدم", "national id", "id number", "username"],
  fullName: ["الاسم الرباعي", "اسم المستخدم الرباعي", "الاسم", "اسم الموظف", "اسم المنسوب", "الاسم الكامل", "اسم المعلم", "full name", "name"],
  phone: ["الجوال", "رقم الجوال", "رقم الهاتف", "الهاتف", "جوال", "mobile", "phone"],
  employmentStatus: ["حالة التوظيف", "الحالة الوظيفية", "حالة الموظف", "employment status"],
  jobTitle: ["المسمى الوظيفي", "الوظيفة", "المهنة", "الرتبة", "job title", "position"],
  teachingField: ["مجال التدريس", "مجال التعليم", "المجال", "teaching field"],
  specialization: ["التخصص", "التخصص العام", "المادة", "specialization", "major"],
} as const;

export type NoorTemplateCheck = {
  matches: boolean;
  matchedColumns: string[];
  missingRequired: string[];
  missingRecommended: string[];
  issues: string[];
  expectedColumns: readonly string[];
};
