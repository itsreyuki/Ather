import ExcelJS from "exceljs";
import { createRequire } from "node:module";
import { nationalIdLookupHash, normalizeEmail, normalizeNoorUsername, normalizePhone, phoneLookupHash } from "./security";
import { NOOR_ROSTER_TEMPLATE, NOOR_TEMPLATE_ALIASES, type NoorTemplateCheck } from "./noor-template";

export const STAFF_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const STAFF_IMPORT_MAX_ROWS = 50_000;
export const STAFF_IMPORT_MAX_PREVIEW_ROWS = 20;
export const STAFF_IMPORT_MAX_PDF_PAGES = 100;
const fields = ["fullName", "nationalId", "phone", "jobTitle", "specialization", "email", "employeeNumber"] as const;
const requiredFields = ["fullName", "nationalId"] as const;
const allowedMimeTypes = new Set(["", "application/octet-stream", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const require = createRequire(import.meta.url);

export type StaffField = (typeof fields)[number];
export type StaffMapping = Partial<Record<StaffField, string>>;
export type StaffRowCorrection = Partial<Record<StaffField, string | null>>;
export type StaffCorrections = Record<string, StaffRowCorrection>;
export type MappingConfidence = "high" | "medium" | "low";
export type ParsedStaffRow = { rowNumber: number; fullName: string; nationalIdHash: string; nationalIdLast4: string; phone: string | null; phoneLast4: string | null; jobTitle: string | null; specialization: string | null; email: string | null; employeeNumber: string | null; errors: string[]; warnings: string[]; duplicateWithinFile: boolean; duplicateInSchool: boolean; duplicatePhoneWithinFile: boolean; duplicatePhoneInSchool: boolean };
export type StaffImportAnalysis = { sheetName: string; headers: string[]; mapping: StaffMapping; confidence: Partial<Record<StaffField, MappingConfidence>>; needsMapping: boolean; noorTemplate: NoorTemplateCheck; rows: ParsedStaffRow[]; emptyRows: number; formulaRows: number; totalRows: number; validRows: number; invalidRows: number; duplicateRows: number; duplicatePhoneRows: number; missingPhoneRows: number; reviewRows: number };

const fieldAliases: Record<StaffField, string[]> = {
  nationalId: [...NOOR_TEMPLATE_ALIASES.nationalId],
  fullName: [...NOOR_TEMPLATE_ALIASES.fullName],
  phone: [...NOOR_TEMPLATE_ALIASES.phone],
  jobTitle: [...NOOR_TEMPLATE_ALIASES.jobTitle],
  specialization: ["التخصص", "التخصص العام", "المادة", "specialization", "major"],
  email: ["البريد الالكتروني", "البريد الإلكتروني", "الايميل", "الإيميل", "email", "e-mail"],
  employeeNumber: ["الرقم الوظيفي", "رقم الموظف", "employee id", "employee number"],
};

function normalizeHeader(value: string) { return value.trim().toLowerCase().normalize("NFKC").replace(/[\u064B-\u065F]/g, "").replace(/[\s_\-:؛،/\\]+/g, " "); }
function cellText(value: unknown): string { if (value === null || value === undefined) return ""; if (typeof value === "object") { if ("text" in value && typeof value.text === "string") return value.text.trim(); if ("result" in value) return cellText(value.result); } return String(value).trim(); }
function headerMatch(header: string, alias: string) { const normalizedHeader = normalizeHeader(header); const normalizedAlias = normalizeHeader(alias); if (!normalizedHeader || !normalizedAlias) return null; if (normalizedHeader === normalizedAlias) return "high" as const; if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)) return "medium" as const; return null; }

function findTemplateHeader(headers: string[], aliases: readonly string[]) {
  const exact = headers.find((header) => aliases.some((alias) => normalizeHeader(header) === normalizeHeader(alias)));
  if (exact) return exact;
  return headers.find((header) => aliases.some((alias) => headerMatch(header, alias) === "medium"));
}

export function checkNoorRosterTemplate(headers: string[], mapping?: StaffMapping): NoorTemplateCheck {
  const matched = new Set<string>();
  const mappedOrFound = (field: StaffField, aliases: readonly string[]) => {
    const selected = mapping?.[field];
    const found = selected && headers.includes(selected) ? selected : findTemplateHeader(headers, aliases);
    if (found) matched.add(found);
    return found;
  };
  const nationalId = mappedOrFound("nationalId", NOOR_TEMPLATE_ALIASES.nationalId);
  const fullName = mappedOrFound("fullName", NOOR_TEMPLATE_ALIASES.fullName);
  const phone = mappedOrFound("phone", NOOR_TEMPLATE_ALIASES.phone);
  const employmentStatus = findTemplateHeader(headers, NOOR_TEMPLATE_ALIASES.employmentStatus);
  const jobTitle = mappedOrFound("jobTitle", NOOR_TEMPLATE_ALIASES.jobTitle);
  const teachingField = findTemplateHeader(headers, NOOR_TEMPLATE_ALIASES.teachingField);
  const specialization = mappedOrFound("specialization", NOOR_TEMPLATE_ALIASES.specialization);
  for (const header of [employmentStatus, teachingField]) if (header) matched.add(header);

  const missingRequired = [
    !nationalId ? "اسم المستخدم في نور" : "",
    !fullName ? "الاسم الرباعي" : "",
  ].filter(Boolean);
  const recommended = [phone, employmentStatus, jobTitle, teachingField, specialization].filter(Boolean);
  const missingRecommended = [
    !phone ? "الجوال" : "",
    !employmentStatus ? "حالة التوظيف" : "",
    !jobTitle ? "المسمى الوظيفي" : "",
    !teachingField ? "مجال التدريس" : "",
    !specialization ? "التخصص" : "",
  ].filter(Boolean);
  const issues: string[] = [];
  if (missingRequired.length) issues.push(`الأعمدة المطلوبة غير موجودة: ${missingRequired.join("، ")}`);
  if (recommended.length < 2) issues.push("لم يتم العثور على عمودين على الأقل من أعمدة نور التعريفية مثل المسمى الوظيفي أو التخصص أو حالة التوظيف");
  return {
    matches: missingRequired.length === 0 && recommended.length >= 2,
    matchedColumns: [...matched],
    missingRequired,
    missingRecommended,
    issues,
    expectedColumns: NOOR_ROSTER_TEMPLATE.expectedColumns,
  };
}

function detectMapping(headers: string[], requested?: StaffMapping) {
  const mapping: StaffMapping = {}; const confidence: Partial<Record<StaffField, MappingConfidence>> = {};
  for (const field of fields) {
    if (requested?.[field] && headers.includes(requested[field]!)) { mapping[field] = requested[field]; confidence[field] = "high"; continue; }
    const matches = headers.flatMap((header) => fieldAliases[field].map((alias) => ({ header, confidence: headerMatch(header, alias) })).filter((match): match is { header: string; confidence: "high" | "medium" } => Boolean(match.confidence)));
    const exact = matches.filter((match) => match.confidence === "high"); const best = exact.length === 1 ? exact[0] : exact.length > 1 ? undefined : matches.length === 1 ? matches[0] : undefined;
    if (best) { mapping[field] = best.header; confidence[field] = best.confidence; } else confidence[field] = "low";
  }
  return { mapping, confidence };
}

function mappedValue(raw: unknown[], headers: string[], mapping: StaffMapping, field: StaffField) { const header = mapping[field]; return header ? cellText(raw[headers.indexOf(header)]) : ""; }

function rowValues(worksheet: ExcelJS.Worksheet, rowNumber: number) { const row = worksheet.getRow(rowNumber); return Array.from({ length: worksheet.columnCount }, (_, index) => row.getCell(index + 1).value); }
function rowHasFormula(worksheet: ExcelJS.Worksheet, rowNumber: number) { let formula = false; worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => { if (cell.formula) formula = true; }); return formula; }

export async function readStaffImportFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "pdf" && extension !== "xlsx") throw new Error("ارفع ملف PDF الرسمي من نور. ملفات XLS القديمة غير مدعومة بأمان.");
  if (!allowedMimeTypes.has(file.type)) throw new Error("نوع الملف لا يطابق PDF أو XLSX مدعومًا");
  if (file.size <= 0) throw new Error("الملف فارغ");
  if (file.size > STAFF_IMPORT_MAX_BYTES) throw new Error("حجم الملف يتجاوز 10MB");
  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength) throw new Error("تعذر قراءة محتوى الملف");
  return { bytes, fileName: file.name.slice(0, 255) };
}

function isPdfRecordIdentifier(line: string) {
  const value = line.replace(/\s+/g, "");
  if (/^(?:966|05)\d{7,12}$/.test(value)) return false;
  return /^\d{8,11}$/.test(value) || /^(?=.*[A-Za-z])[A-Za-z0-9_]{6,32}$/.test(value);
}

function isPdfPhone(line: string) {
  return /^(?:\+?966|\+?05)\d{7,12}$/.test(line.replace(/[\s()-]/g, ""));
}

function normalizeNoorPdfArabic(value: string) {
  return value
    .replace(/عبدا1/g, "عبدالله")
    .replace(/ا1/g, "الله")
    .replace(/ا_جتماعية/g, "الاجتماعية")
    .replace(/Iنجليزية/g, "الإنجليزية")
    .replace(/معلم(?:ا)?الإنجليزية/g, "معلم الإنجليزية");
}

function restoreNoorPdfRtlLine(value: string) {
  return normalizeNoorPdfArabic(value).split(/\s+/).filter(Boolean).reverse().join(" ");
}

const noorPdfSpecializations = [
  "اقتصاد منزلي",
  "الاقتصاد المنزلي",
  "تقنية المعلومات",
  "اللغة الإنجليزية",
  "اللغة العربية",
  "إنجليزي",
  "انجليزي",
  "رياضيات",
  "أحياء",
  "احياء",
  "حاسب",
  "عربي",
  "بدنية",
  "دين",
  "علوم",
  "فيزياء",
  "كيمياء",
  "تاريخ",
].sort((left, right) => right.length - left.length);

function parseNoorPdfColumns(value: string) {
  let remainder = normalizeNoorPdfArabic(value)
    .replace(/معلما[;:]?لي/g, "معلم")
    .replace(/\s+/g, " ")
    .trim();
  const employmentMatch = remainder.match(/(?:على رأس العمل|متعاقد|مؤقت|دائم)/);
  const employment = employmentMatch?.[0] ?? "";
  if (employmentMatch) remainder = `${remainder.slice(0, employmentMatch.index)} ${remainder.slice((employmentMatch.index ?? 0) + employmentMatch[0].length)}`.trim();

  const jobMatch = remainder.match(/(?:معلمة|معلم|إدارية|إداري|وكيلة|وكيل|مرشدة|مرشد|قائدة|قائد|مديرة|مدير)/);
  const jobTitle = jobMatch?.[0] ?? "";
  if (jobMatch) remainder = `${remainder.slice(0, jobMatch.index)} ${remainder.slice((jobMatch.index ?? 0) + jobMatch[0].length)}`.trim();

  let specialization = "";
  const candidate = noorPdfSpecializations.find((item) => remainder.endsWith(item));
  if (candidate) {
    specialization = candidate.replace(/^الاقتصاد/, "اقتصاد");
    remainder = remainder.slice(0, -candidate.length).trim();
  }

  let teachingField = remainder;
  if (/الاجتماعية التربية والوطنية/.test(teachingField)) teachingField = "التربية الاجتماعية والوطنية";
  else if (teachingField.split(/\s+/).length > 1) teachingField = restoreNoorPdfRtlLine(teachingField);

  // A PDF text layer can omit the final column separator. Keep the value
  // useful and reviewable instead of storing status/title/subject together.
  if (!specialization && teachingField) {
    const words = teachingField.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      specialization = words.slice(-2).join(" ");
      teachingField = words.slice(0, -2).join(" ") || words[0];
    } else {
      specialization = teachingField;
    }
  }

  return { employment, jobTitle, teachingField, specialization };
}

/** Converts the row-oriented text layer of Noor's PDF table into import rows. */
export function parseNoorPdfRows(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const starts = lines.map((line, index) => isPdfRecordIdentifier(line) ? index : -1).filter((index) => index >= 0);
  const rows: string[][] = [];
  for (let startIndex = 0; startIndex < starts.length; startIndex += 1) {
    const start = starts[startIndex];
    const end = starts[startIndex + 1] ?? lines.length;
    const segment = lines.slice(start, end);
    const phoneIndex = segment.findIndex((line, index) => index > 0 && isPdfPhone(line));
    if (phoneIndex < 1) continue;
    const identifier = segment[0].replace(/\s+/g, "");
    const fullName = segment.slice(1, phoneIndex).map(restoreNoorPdfRtlLine).join(" ");
    if (!fullName) continue;
    const tail = segment.slice(phoneIndex + 1).join(" ");
    const columns = parseNoorPdfColumns(tail);
    rows.push([
      identifier,
      fullName,
      segment[phoneIndex].replace(/\s+/g, ""),
      columns.employment,
      columns.jobTitle,
      columns.teachingField,
      columns.specialization,
    ]);
  }
  return rows;
}

async function analyzeNoorPdf(input: { bytes: ArrayBuffer | Uint8Array; fileName: string; mapping?: StaffMapping; corrections?: StaffCorrections; existingIdHashes?: Set<string>; existingPhoneHashes?: Set<string> }): Promise<StaffImportAnalysis> {
  const byteView = input.bytes instanceof ArrayBuffer ? new Uint8Array(input.bytes) : input.bytes;
  let text = "";
  let pageCount = 0;
  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (data: Buffer) => Promise<{ text: string; numpages: number }>;
    const result = await pdfParse(Buffer.from(byteView));
    pageCount = result.numpages;
    text = result.text;
  } catch {
    throw new Error("تعذر قراءة ملف PDF. تأكد من أن الملف الرسمي من نور غير تالف وليس صورة ممسوحة ضوئيًا.");
  }
  if (pageCount > STAFF_IMPORT_MAX_PDF_PAGES) throw new Error("ملف PDF يتجاوز الحد المسموح لعدد الصفحات.");
  if (text.length > 25_000_000) throw new Error("النص المستخرج من ملف PDF كبير جدًا للمعالجة الآمنة.");
  const rows = parseNoorPdfRows(text);
  if (!text.includes("الجوال") && !text.includes("التوظيف")) throw new Error("ملف PDF لا يطابق تقرير المنسوبين من نظام نور.");
  if (!rows.length) throw new Error("لم يتم العثور على سجلات قابلة للقراءة داخل ملف نور. استخدم PDF نصيًا صادرًا مباشرة من نور، وليس صورة ممسوحة.");
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("قائمة المنسوبين").addRows([NOOR_ROSTER_TEMPLATE.expectedColumns, ...rows]);
  const xlsxBytes = await workbook.xlsx.writeBuffer();
  return analyzeStaffWorkbook({
    bytes: xlsxBytes,
    fileName: `${input.fileName}.xlsx`,
    mapping: input.mapping,
    corrections: input.corrections,
    existingIdHashes: input.existingIdHashes,
    existingPhoneHashes: input.existingPhoneHashes,
  });
}

export async function analyzeStaffWorkbook(input: { bytes: ArrayBuffer | Uint8Array; fileName: string; mapping?: StaffMapping; corrections?: StaffCorrections; existingIdHashes?: Set<string>; existingPhoneHashes?: Set<string> }): Promise<StaffImportAnalysis> {
  if (input.fileName.toLowerCase().endsWith(".pdf")) return analyzeNoorPdf(input);
  if (!input.fileName.toLowerCase().endsWith(".xlsx")) throw new Error("صيغة الملف المدعومة هي XLSX فقط");
  const workbook = new ExcelJS.Workbook();
  const byteView = input.bytes instanceof ArrayBuffer ? new Uint8Array(input.bytes) : input.bytes;
  const buffer = Buffer.from(byteView as Uint8Array);
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); } catch { throw new Error("تعذر قراءة ملف Excel. تأكد من أن الملف غير تالف."); }
  const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0);
  if (!worksheet) throw new Error("لم يتم العثور على ورقة بيانات صالحة داخل الملف");
  const matrix = Array.from({ length: worksheet.rowCount }, (_, index) => rowValues(worksheet, index + 1));
  let headerRow = -1; let headers: string[] = []; let bestScore = 0;
  for (let rowIndex = 0; rowIndex < Math.min(10, matrix.length); rowIndex += 1) { const candidate = matrix[rowIndex].map(cellText); const score = candidate.reduce((sum, header) => sum + (fields.some((field) => fieldAliases[field].some((alias) => headerMatch(header, alias))) || Object.values(NOOR_TEMPLATE_ALIASES).some((aliases) => aliases.some((alias) => headerMatch(header, alias))) ? 1 : 0), 0); if (score > bestScore) { bestScore = score; headerRow = rowIndex; headers = candidate; } }
  if (headerRow < 0 || bestScore < 1) throw new Error("تعذر اكتشاف صف عناوين الأعمدة. استخدم ملفًا يحتوي على عناوين واضحة.");
  headers = headers.map((header, index) => header || `عمود ${index + 1}`);
  const { mapping, confidence } = detectMapping(headers, input.mapping); const noorTemplate = checkNoorRosterTemplate(headers, mapping); const dataRows = matrix.slice(headerRow + 1);
  if (dataRows.length > STAFF_IMPORT_MAX_ROWS) throw new Error(`الملف يتجاوز الحد الأعلى البالغ ${STAFF_IMPORT_MAX_ROWS.toLocaleString("ar-SA")} صف`);
  const seen = new Map<string, number>(); const seenPhones = new Map<string, number>(); const rows: ParsedStaffRow[] = []; let emptyRows = 0; let formulaRows = 0;
  for (let index = 0; index < dataRows.length; index += 1) {
    const raw = dataRows[index]; const rowNumber = headerRow + index + 2;
    if (raw.every((cell) => !cellText(cell))) { emptyRows += 1; continue; }
    const errors: string[] = []; const warnings: string[] = []; if (rowHasFormula(worksheet, rowNumber)) { errors.push("تحتوي الخلية على معادلة غير متوقعة"); formulaRows += 1; } if (raw.some((cell) => cellText(cell).length > 500)) errors.push("يوجد نص يتجاوز الحد المسموح"); if (raw.some((cell) => /^=/.test(cellText(cell)))) errors.push("يوجد محتوى يشبه معادلة Excel");
    const correction = input.corrections?.[String(rowNumber)] ?? {};
    const corrected = (field: StaffField) => correction[field] === null ? "" : typeof correction[field] === "string" ? correction[field]!.trim() : mappedValue(raw, headers, mapping, field);
    const fullName = corrected("fullName"); const nationalId = normalizeNoorUsername(corrected("nationalId")); const phoneValue = corrected("phone"); const phone = phoneValue ? normalizePhone(phoneValue) : null; const jobTitle = corrected("jobTitle") || null; const specialization = corrected("specialization") || null; const emailValue = corrected("email"); const email = emailValue ? normalizeEmail(emailValue) : null; const employeeNumber = corrected("employeeNumber") || null;
    if (!fullName) errors.push("الاسم مطلوب"); if (fullName.length > 200) errors.push("الاسم طويل جدًا"); if (!nationalId) errors.push("اسم المستخدم في نور مطلوب"); if (nationalId && !/^[\p{L}\p{N}._-]{3,64}$/u.test(nationalId)) errors.push("اسم المستخدم في نور غير صالح"); if (phone && !/^\+?\d{7,15}$/.test(phone)) errors.push("رقم الجوال غير صالح"); if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("البريد الإلكتروني غير صالح");
    const nationalIdHash = nationalId ? nationalIdLookupHash(nationalId) : ""; const duplicateWithinFile = Boolean(nationalIdHash && seen.has(nationalIdHash)); if (duplicateWithinFile) errors.push(`اسم المستخدم في نور مكرر داخل الملف (الصف ${seen.get(nationalIdHash)})`); else if (nationalIdHash) seen.set(nationalIdHash, rowNumber); const duplicateInSchool = Boolean(nationalIdHash && input.existingIdHashes?.has(nationalIdHash));
    if (duplicateInSchool) warnings.push("اسم المستخدم في نور موجود مسبقًا في المدرسة. سيُحدّث السجل الحالي دون إنشاء سجل جديد.");
    const duplicatePhoneWithinFile = Boolean(phone && seenPhones.has(phone!)); if (duplicatePhoneWithinFile) warnings.push(`رقم الجوال مكرر داخل الملف (الصف ${seenPhones.get(phone!)}). سيحتاج هذا التعارض إلى مراجعة قبل دخول المعلم.`); else if (phone) seenPhones.set(phone, rowNumber);
    const duplicatePhoneInSchool = Boolean(phone && input.existingPhoneHashes?.has(phoneLookupHash(phone!)));
    if (duplicatePhoneInSchool) warnings.push("رقم الجوال مستخدم لسجل آخر في المدرسة. لن يُسمح بالدخول الذاتي حتى تُراجع الإدارة التعارض.");
    rows.push({ rowNumber, fullName, nationalIdHash, nationalIdLast4: nationalId.slice(-4), phone, phoneLast4: phone?.slice(-4) ?? null, jobTitle, specialization, email, employeeNumber, errors, warnings, duplicateWithinFile, duplicateInSchool, duplicatePhoneWithinFile, duplicatePhoneInSchool });
  }
  const invalidRows = rows.filter((row) => row.errors.length > 0).length; const validRows = rows.length - invalidRows; const duplicateRows = rows.filter((row) => row.duplicateWithinFile || row.duplicateInSchool).length; const duplicatePhoneRows = rows.filter((row) => row.duplicatePhoneWithinFile || row.duplicatePhoneInSchool).length; const missingPhoneRows = rows.filter((row) => !row.phone).length; const reviewRows = rows.filter((row) => row.warnings.length > 0 || row.duplicateInSchool).length;
  return { sheetName: worksheet.name, headers, mapping, confidence, needsMapping: requiredFields.some((field) => confidence[field] !== "high") || fields.some((field) => confidence[field] === "medium"), noorTemplate, rows, emptyRows, formulaRows, totalRows: dataRows.length - emptyRows, validRows, invalidRows, duplicateRows, duplicatePhoneRows, missingPhoneRows, reviewRows };
}

export function exportSafeSpreadsheetValue(value: string | null | undefined) { const text = value ?? ""; return /^[=+\-@]/.test(text) ? `'${text}` : text; }
