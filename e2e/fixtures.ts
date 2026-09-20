import ExcelJS from "exceljs";

export async function rosterFixture(nationalId = "1000000001", phone: string | null = null) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Roster");
  const headers = ["Name", "National ID", "Job Title", "Specialization"];
  const row = ["E2E Teacher", nationalId, "Teacher", "Mathematics"];
  if (phone) {
    headers.splice(2, 0, "Phone");
    row.splice(2, 0, phone);
  }
  sheet.addRows([headers, row]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const registrationPassword = "E2e-password-123";

export async function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}
