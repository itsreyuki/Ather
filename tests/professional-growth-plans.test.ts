import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  matchProfessionalFacilitator,
  normalizeProfessionalName,
  parseProfessionalPlanWorkbook,
} from "../src/lib/professional-growth-plans";

const staff = [
  { id: "a", fullName: "أحمد محمد الغامدي", jobTitle: "معلم" },
  { id: "b", fullName: "أحمد علي الغامدي", jobTitle: "معلم" },
  { id: "c", fullName: "سارة عبدالله الحربي", jobTitle: "وكيلة" },
];

describe("professional growth plans", () => {
  it("normalizes Arabic executor names and matches full, first/second, and first/last variants", () => {
    expect(normalizeProfessionalName("  أَحْمَد، محمد الغامدي ")).toBe("احمد محمد الغامدي");
    expect(matchProfessionalFacilitator("أحمد محمد", staff)).toMatchObject({
      state: "MATCHED",
      staffId: "a",
    });
    expect(matchProfessionalFacilitator("سارة الحربي", staff)).toMatchObject({
      state: "MATCHED",
      staffId: "c",
    });
    expect(matchProfessionalFacilitator("أحمد", staff)).toMatchObject({ state: "AMBIGUOUS", staffId: null });
    expect(matchProfessionalFacilitator("فاطمة", staff)).toMatchObject({ state: "MISSING", staffId: null });
  });

  it("accepts only the official XLSX sheet and resolves a unique executor", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("البرامج").addRows([
      ["اسم البرنامج", "نوع البرنامج", "المنفذ"],
      ["التعلم الرقمي", "تقني تعليمي", "سارة الحربي"],
    ]);
    const bytes = await workbook.xlsx.writeBuffer();
    const rows = await parseProfessionalPlanWorkbook(
      new File([bytes], "plan.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      staff,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "التعلم الرقمي",
      programType: "TECHNICAL_EDUCATIONAL",
      match: { state: "MATCHED", staffId: "c" },
    });
  });

  it("rejects a workbook that does not use the official template", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Sheet1").addRow(["Program", "Type", "Executor"]);
    const bytes = await workbook.xlsx.writeBuffer();
    await expect(parseProfessionalPlanWorkbook(new File([bytes], "wrong.xlsx"), staff)).rejects.toThrow(
      "نموذج الخطة",
    );
  });
});
