import { describe, expect, it } from "vitest";
import { criterionMetric, compositeImpact } from "../src/lib/metrics";
import { hashPassword, normalizeEmail, normalizePhone, verifyPassword } from "../src/lib/security";
import { registerSchema } from "../src/lib/auth-schemas";
import ExcelJS from "exceljs";
import { analyzeStaffWorkbook, parseNoorPdfRows } from "../src/lib/staff-import";

process.env.ID_LOOKUP_SECRET = Buffer.from("test-only-lookup-secret").toString("base64");

describe("impact metrics", () => {
  it("calculates improvement and potential improvement separately", () => {
    const metric = criterionMetric([2, 3, 3], [4, 4, 5]);
    expect(metric.preAverage).toBeCloseTo(2.67, 1);
    expect(metric.postAverage).toBeCloseTo(4.33, 1);
    expect(metric.changePoints).toBeCloseTo(1.67, 1);
    expect(metric.improvementOnScale).toBeCloseTo(41.67, 1);
    expect(metric.potentialImprovement).toBeCloseTo(71.43, 1);
  });

  it("keeps the composite score transparent", () => {
    expect(compositeImpact(75, 50, 0.8)).toBe(70);
  });

  it("normalizes contacts and verifies scrypt passwords", () => {
    expect(normalizeEmail("  Admin@School.SA ")).toBe("admin@school.sa");
    expect(normalizePhone(" ٠٥٠ ١٢٣ ٤٥٦٧ ")).toBe("0501234567");
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("requires exactly one contact method during registration", () => {
    expect(registerSchema.safeParse({ email: "admin@school.sa", password: "password123", confirmPassword: "password123" }).success).toBe(true);
    expect(registerSchema.safeParse({ email: "admin@school.sa", phone: "0501234567", password: "password123", confirmPassword: "password123" }).success).toBe(false);
  });

  it("detects common Arabic Noor headers and flags duplicates/missing phones", async () => {
    const excel = new ExcelJS.Workbook();
    const sheet = excel.addWorksheet("البيانات");
    sheet.addRows([["اسم الموظف", "الهوية الوطنية", "رقم الجوال", "المسمى الوظيفي"], ["سارة علي", "١٢٣٤٥٦٧٨٩٠", "٠٥٠١٢٣٤٥٦٧", "معلمة"], ["سارة علي", "١٢٣٤٥٦٧٨٩٠", "", "معلمة"]]);
    const workbook = await excel.xlsx.writeBuffer();
    const analysis = await analyzeStaffWorkbook({ bytes: workbook, fileName: "noor.xlsx" });
    expect(analysis.mapping.fullName).toBe("اسم الموظف");
    expect(analysis.mapping.nationalId).toBe("الهوية الوطنية");
    expect(analysis.duplicateRows).toBe(1);
    expect(analysis.duplicatePhoneRows).toBe(0);
    expect(analysis.missingPhoneRows).toBe(1);
    expect(analysis.rows[1]?.errors[0]).toContain("مكرر");
  });

  it("flags a shared phone without importing it as a duplicate identity", async () => {
    const excel = new ExcelJS.Workbook();
    const sheet = excel.addWorksheet("data");
    sheet.addRows([["name", "national id", "phone", "job title"], ["A", "1234567890", "0501234567", "Teacher"], ["B", "1234567891", "0501234567", "Teacher"]]);
    const workbook = await excel.xlsx.writeBuffer();
    const analysis = await analyzeStaffWorkbook({ bytes: workbook, fileName: "phones.xlsx" });
    expect(analysis.validRows).toBe(2);
    expect(analysis.duplicatePhoneRows).toBe(1);
    expect(analysis.rows[1]?.duplicatePhoneWithinFile).toBe(true);
    expect(analysis.rows[1]?.errors).toEqual([]);
  });

  it("re-analyzes row corrections and clears the row errors before commit", async () => {
    const excel = new ExcelJS.Workbook();
    excel.addWorksheet("data").addRows([
      ["name", "national id", "phone", "job title"],
      ["A", "1234567890", "0501234567", "Teacher"],
      ["B", "", "not-a-phone", "Teacher"],
    ]);
    const bytes = await excel.xlsx.writeBuffer();
    const before = await analyzeStaffWorkbook({ bytes, fileName: "corrections.xlsx" });
    expect(before.invalidRows).toBe(1);
    expect(before.rows[1]?.errors.join(" ")).toContain("مستخدم");

    const after = await analyzeStaffWorkbook({
      bytes,
      fileName: "corrections.xlsx",
      corrections: { "3": { nationalId: "1234567891", phone: "0507654321" } },
    });
    expect(after.invalidRows).toBe(0);
    expect(after.rows[1]?.errors).toEqual([]);
    expect(after.rows[1]?.phone).toBe("0507654321");
  });

  it("recognizes the official Noor roster shape with common Arabic labels", async () => {
    const excel = new ExcelJS.Workbook();
    excel.addWorksheet("المنسوبون").addRows([
      ["رقم الهوية", "الاسم الرباعي", "الجوال", "حالة التوظيف", "المسمى الوظيفي", "مجال التدريس", "التخصص"],
      ["1234567890", "أحمد محمد (مثال)", "0500000000", "دائم", "معلم", "الحاسب", "تقنية المعلومات"],
    ]);
    const analysis = await analyzeStaffWorkbook({ bytes: await excel.xlsx.writeBuffer(), fileName: "noor-official.xlsx" });
    expect(analysis.noorTemplate.matches).toBe(true);
    expect(analysis.mapping.fullName).toBe("الاسم الرباعي");
    expect(analysis.mapping.nationalId).toBe("رقم الهوية");
  });

  it("keeps a Noor username as the lookup identifier, including non-numeric usernames", async () => {
    const excel = new ExcelJS.Workbook();
    excel.addWorksheet("المنسوبون").addRows([
      ["اسم المستخدم", "الاسم الرباعي", "الجوال", "حالة التوظيف", "المسمى الوظيفي", "مجال التدريس", "التخصص"],
      ["teacher_ahmad.1", "أحمد تجريبي", "0500000000", "دائم", "معلم", "الحاسب", "تقنية المعلومات"],
    ]);
    const analysis = await analyzeStaffWorkbook({ bytes: await excel.xlsx.writeBuffer(), fileName: "noor-username.xlsx" });
    expect(analysis.rows[0]?.errors).toEqual([]);
    expect(analysis.rows[0]?.nationalIdHash).toBeTruthy();
    expect(analysis.rows[0]?.nationalIdLast4).toBe("ad.1");
  });

  it("rejects a workbook that has no recognizable Noor structure", async () => {
    const excel = new ExcelJS.Workbook();
    excel.addWorksheet("data").addRows([["الاسم", "رقم الهوية"], ["سجل تجريبي", "1234567890"]]);
    const analysis = await analyzeStaffWorkbook({ bytes: await excel.xlsx.writeBuffer(), fileName: "manual-list.xlsx" });
    expect(analysis.noorTemplate.matches).toBe(false);
    expect(analysis.noorTemplate.issues.join(" ")).toContain("أعمدة نور");
  });

  it("extracts row order from the text layer of a Noor PDF", () => {
    const rows = parseNoorPdfRows([
      "اسم المستخدم الاسم الرباعي الجوال حالة التوظيف المسمى الوظيفي مجال التدريس التخصص",
      "1234567890",
      "تجريبي معلم",
      "966500000000",
      "دائم معلم رياضيات رياضيات",
      "1234567891",
      "تجريبية معلمة",
      "966511111111",
      "دائم معلمة علوم علوم",
    ].join("\n"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["1234567890", "معلم تجريبي", "966500000000", "دائم", "معلم", "رياضيات", "رياضيات"]);
  });

  it("handles Noor PDF rows whose columns are extracted on one line", () => {
    const rows = parseNoorPdfRows([
      "اسم المستخدمالاسم الرباعيالجوال حالة التوظيف المسمى الوظيفي مجال التدريسالتخصص",
      "1057704957آمال سعود عبد الله الغامدي966535801122 معلمالحاسب الآليحاسب",
      "Emaan0711ايمان احمد عطية الغامدي966500503230دائممعلمأحياءأحياء",
    ].join("\n"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.[0]).toBe("1057704957");
    expect(rows[0]?.[1]).toContain("آمال سعود");
    expect(rows[0]?.[2]).toBe("966535801122");
    expect(rows[1]?.[0]).toBe("Emaan0711");
  });

  it("separates specialization from the concatenated Noor PDF columns", () => {
    const rows = parseNoorPdfRows([
      "1057704957",
      "آمال سعود عبدالله الغامدي",
      "966535801122",
      "دائممعلما;لي الحاسبحاسب",
      "1012839435",
      "باسمه بنت علي بن محمد الغامدي",
      "966555433080",
      "دائممعلماIنجليزية اللغةإنجليزي",
      "1036962551",
      "حنان محمد علي الغامدي",
      "966552361310",
      "دائممعلمرياضياترياضيات",
    ].join("\n"));
    expect(rows.map((row) => row.slice(3))).toEqual([
      ["دائم", "معلم", "الحاسب", "حاسب"],
      ["دائم", "معلم", "اللغة الإنجليزية", "إنجليزي"],
      ["دائم", "معلم", "رياضيات", "رياضيات"],
    ]);
  });

  it("rejects corrupted and zero-record workbooks before import", async () => {
    await expect(analyzeStaffWorkbook({ bytes: Buffer.from("not-an-xlsx"), fileName: "corrupt.xlsx" })).rejects.toThrow();
    const empty = new ExcelJS.Workbook();
    await expect(analyzeStaffWorkbook({ bytes: await empty.xlsx.writeBuffer(), fileName: "empty.xlsx" })).rejects.toThrow();
  });
});
