import ExcelJS from "exceljs";
import { createRequire } from "node:module";
import {
  nationalIdLookupHash,
  normalizeEmail,
  normalizeNoorUsername,
  normalizePhone,
  phoneLookupHash,
} from "./security";
import { NOOR_ROSTER_TEMPLATE, NOOR_TEMPLATE_ALIASES, type NoorTemplateCheck } from "./noor-template";

export const STAFF_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const STAFF_IMPORT_MAX_FILES = 20;
export const STAFF_IMPORT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const STAFF_IMPORT_MAX_ROWS = 50_000;
export const STAFF_IMPORT_MAX_PREVIEW_ROWS = 20;
export const STAFF_IMPORT_MAX_PDF_PAGES = 100;
const fields = [
  "fullName",
  "nationalId",
  "phone",
  "jobTitle",
  "specialization",
  "email",
  "employeeNumber",
] as const;
const requiredFields = ["fullName", "nationalId"] as const;
const allowedMimeTypes = new Set([
  "",
  "application/octet-stream",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const require = createRequire(import.meta.url);

export type StaffField = (typeof fields)[number];
export type StaffMapping = Partial<Record<StaffField, string>>;
export type StaffRowCorrection = Partial<Record<StaffField, string | null>>;
export type StaffCorrections = Record<string, StaffRowCorrection>;
export type MappingConfidence = "high" | "medium" | "low";
export type StaffSimilarityKind =
  "NAME_SIMILAR" | "PHONE_SIMILAR" | "USERNAME_SIMILAR" | "EMPLOYEE_NUMBER_SIMILAR";
export type StaffImportReviewFlag = {
  kind: StaffSimilarityKind;
  confidence: number;
  message: string;
  relatedSourceName: string;
  relatedRowNumber: number;
  relatedFullName: string;
  relatedUsernameLast4: string;
  relatedPhoneLast4: string | null;
};
export type ParsedStaffRow = {
  rowNumber: number;
  sourceIndex?: number;
  sourceName?: string;
  fullName: string;
  nationalIdHash: string;
  nationalIdLast4: string;
  /** Server-only normalized username used for fuzzy matching; never returned to the client. */
  nationalIdComparable?: string;
  phone: string | null;
  phoneLast4: string | null;
  jobTitle: string | null;
  specialization: string | null;
  email: string | null;
  employeeNumber: string | null;
  errors: string[];
  warnings: string[];
  reviewFlags: StaffImportReviewFlag[];
  duplicateWithinFile: boolean;
  duplicateInSchool: boolean;
  duplicatePhoneWithinFile: boolean;
  duplicatePhoneInSchool: boolean;
};
export type StaffImportAnalysis = {
  sheetName: string;
  headers: string[];
  mapping: StaffMapping;
  confidence: Partial<Record<StaffField, MappingConfidence>>;
  needsMapping: boolean;
  noorTemplate: NoorTemplateCheck;
  rows: ParsedStaffRow[];
  emptyRows: number;
  formulaRows: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  duplicatePhoneRows: number;
  missingPhoneRows: number;
  reviewRows: number;
};

const fieldAliases: Record<StaffField, string[]> = {
  nationalId: [...NOOR_TEMPLATE_ALIASES.nationalId],
  fullName: [...NOOR_TEMPLATE_ALIASES.fullName],
  phone: [...NOOR_TEMPLATE_ALIASES.phone],
  jobTitle: [...NOOR_TEMPLATE_ALIASES.jobTitle],
  specialization: ["التخصص", "التخصص العام", "المادة", "specialization", "major"],
  email: ["البريد الالكتروني", "البريد الإلكتروني", "الايميل", "الإيميل", "email", "e-mail"],
  employeeNumber: ["الرقم الوظيفي", "رقم الموظف", "employee id", "employee number"],
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[\s_\-:؛،/\\]+/g, " ");
}
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result);
  }
  return String(value).trim();
}
function headerMatch(header: string, alias: string) {
  const normalizedHeader = normalizeHeader(header);
  const normalizedAlias = normalizeHeader(alias);
  if (!normalizedHeader || !normalizedAlias) return null;
  if (normalizedHeader === normalizedAlias) return "high" as const;
  if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader))
    return "medium" as const;
  return null;
}

function findTemplateHeader(headers: string[], aliases: readonly string[]) {
  const exact = headers.find((header) =>
    aliases.some((alias) => normalizeHeader(header) === normalizeHeader(alias)),
  );
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

  const missingRequired = [!nationalId ? "اسم المستخدم في نور" : "", !fullName ? "الاسم الرباعي" : ""].filter(
    Boolean,
  );
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
  if (recommended.length < 2)
    issues.push(
      "لم يتم العثور على عمودين على الأقل من أعمدة نور التعريفية مثل المسمى الوظيفي أو التخصص أو حالة التوظيف",
    );
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
  const mapping: StaffMapping = {};
  const confidence: Partial<Record<StaffField, MappingConfidence>> = {};
  for (const field of fields) {
    if (requested?.[field] && headers.includes(requested[field]!)) {
      mapping[field] = requested[field];
      confidence[field] = "high";
      continue;
    }
    const matches = headers.flatMap((header) =>
      fieldAliases[field]
        .map((alias) => ({ header, confidence: headerMatch(header, alias) }))
        .filter((match): match is { header: string; confidence: "high" | "medium" } =>
          Boolean(match.confidence),
        ),
    );
    const exact = matches.filter((match) => match.confidence === "high");
    const best =
      exact.length === 1
        ? exact[0]
        : exact.length > 1
          ? undefined
          : matches.length === 1
            ? matches[0]
            : undefined;
    if (best) {
      mapping[field] = best.header;
      confidence[field] = best.confidence;
    } else confidence[field] = "low";
  }
  return { mapping, confidence };
}

function mappedValue(raw: unknown[], headers: string[], mapping: StaffMapping, field: StaffField) {
  const header = mapping[field];
  return header ? cellText(raw[headers.indexOf(header)]) : "";
}

function rowValues(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = worksheet.getRow(rowNumber);
  return Array.from({ length: worksheet.columnCount }, (_, index) => row.getCell(index + 1).value);
}
function rowHasFormula(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  let formula = false;
  worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
    if (cell.formula) formula = true;
  });
  return formula;
}

export async function readStaffImportFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "pdf" && extension !== "xlsx")
    throw new Error("ارفع ملف PDF الرسمي من نور. ملفات XLS القديمة غير مدعومة بأمان.");
  if (!allowedMimeTypes.has(file.type)) throw new Error("نوع الملف لا يطابق PDF أو XLSX مدعومًا");
  if (file.size <= 0) throw new Error("الملف فارغ");
  if (file.size > STAFF_IMPORT_MAX_BYTES) throw new Error("حجم الملف يتجاوز 10MB");
  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength) throw new Error("تعذر قراءة محتوى الملف");
  return { bytes, fileName: file.name.slice(0, 255) };
}

const pdfRecordIdentifierPattern =
  /(?<![A-Za-z0-9_.-])(?:\d{8,11}(?!\d)|[A-Za-z][A-Za-z0-9_.-]{5,63}(?![A-Za-z0-9_.-]))/gu;
const pdfPhonePattern = /(?:\+?966\d{9}|\+?05\d{8,9})/;

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

function restoreNoorPdfName(value: string) {
  const words = normalizeNoorPdfArabic(value).split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  // Some Noor PDF text layers return a short visual-order fragment such as
  // "تجريبي معلم". Real names in the current export are returned in reading
  // order, so reverse only when the final token is clearly a job title.
  const titleAtEnd = /^(?:معلم|معلمة|إداري|إدارية|وكيل|وكيلة|مرشد|مرشدة|مدير|مديرة|قائد|قائدة)$/u.test(
    words.at(-1) ?? "",
  );
  return (titleAtEnd ? words.reverse() : words).join(" ");
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
  if (employmentMatch)
    remainder =
      `${remainder.slice(0, employmentMatch.index)} ${remainder.slice((employmentMatch.index ?? 0) + employmentMatch[0].length)}`.trim();

  const jobMatch = remainder.match(/(?:معلمة|معلم|إدارية|إداري|وكيلة|وكيل|مرشدة|مرشد|قائدة|قائد|مديرة|مدير)/);
  const jobTitle = jobMatch?.[0] ?? "";
  if (jobMatch)
    remainder =
      `${remainder.slice(0, jobMatch.index)} ${remainder.slice((jobMatch.index ?? 0) + jobMatch[0].length)}`.trim();

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
  // PDF text extraction is not consistent: depending on column positions it
  // may return a whole row on one line or split the same row across lines.
  // Flatten first, then split on record identifiers and locate the phone
  // inside each segment instead of relying on line boundaries.
  const flattened = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const starts = [...flattened.matchAll(pdfRecordIdentifierPattern)]
    .map((match) => ({ index: match.index ?? -1, identifier: match[0] }))
    .filter((match) => match.index >= 0);
  const rows: string[][] = [];
  for (let startIndex = 0; startIndex < starts.length; startIndex += 1) {
    const current = starts[startIndex];
    const start = current.index + current.identifier.length;
    const end = starts[startIndex + 1]?.index ?? flattened.length;
    const segment = flattened.slice(start, end).trim();
    const phoneMatch = segment.match(pdfPhonePattern);
    if (!phoneMatch || phoneMatch.index === undefined) continue;
    const phoneStart = phoneMatch.index;
    const phone = phoneMatch[0];
    const fullName = restoreNoorPdfName(segment.slice(0, phoneStart).trim());
    if (!fullName) continue;
    const tail = segment.slice(phoneStart + phone.length).trim();
    const columns = parseNoorPdfColumns(tail);
    rows.push([
      current.identifier,
      fullName,
      phone.replace(/\s+/g, ""),
      columns.employment,
      columns.jobTitle,
      columns.teachingField,
      columns.specialization,
    ]);
  }
  return rows;
}

async function analyzeNoorPdf(input: {
  bytes: ArrayBuffer | Uint8Array;
  fileName: string;
  mapping?: StaffMapping;
  corrections?: StaffCorrections;
  existingIdHashes?: Set<string>;
  existingPhoneHashes?: Set<string>;
}): Promise<StaffImportAnalysis> {
  const byteView = input.bytes instanceof ArrayBuffer ? new Uint8Array(input.bytes) : input.bytes;
  let text = "";
  let pageCount = 0;
  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      data: Buffer,
    ) => Promise<{ text: string; numpages: number }>;
    const result = await pdfParse(Buffer.from(byteView));
    pageCount = result.numpages;
    text = result.text;
  } catch {
    throw new Error("تعذر قراءة ملف PDF. تأكد من أن الملف الرسمي من نور غير تالف وليس صورة ممسوحة ضوئيًا.");
  }
  if (pageCount > STAFF_IMPORT_MAX_PDF_PAGES) throw new Error("ملف PDF يتجاوز الحد المسموح لعدد الصفحات.");
  if (text.length > 25_000_000) throw new Error("النص المستخرج من ملف PDF كبير جدًا للمعالجة الآمنة.");
  const rows = parseNoorPdfRows(text);
  if (!text.includes("الجوال") && !text.includes("التوظيف"))
    throw new Error("ملف PDF لا يطابق تقرير المنسوبين من نظام نور.");
  if (!rows.length)
    throw new Error(
      "لم يتم العثور على سجلات قابلة للقراءة داخل ملف نور. استخدم PDF نصيًا صادرًا مباشرة من نور، وليس صورة ممسوحة.",
    );
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

export async function analyzeStaffWorkbook(input: {
  bytes: ArrayBuffer | Uint8Array;
  fileName: string;
  mapping?: StaffMapping;
  corrections?: StaffCorrections;
  existingIdHashes?: Set<string>;
  existingPhoneHashes?: Set<string>;
}): Promise<StaffImportAnalysis> {
  if (input.fileName.toLowerCase().endsWith(".pdf")) return analyzeNoorPdf(input);
  if (!input.fileName.toLowerCase().endsWith(".xlsx")) throw new Error("صيغة الملف المدعومة هي XLSX فقط");
  const workbook = new ExcelJS.Workbook();
  const byteView = input.bytes instanceof ArrayBuffer ? new Uint8Array(input.bytes) : input.bytes;
  const buffer = Buffer.from(byteView as Uint8Array);
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error("تعذر قراءة ملف Excel. تأكد من أن الملف غير تالف.");
  }
  const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0);
  if (!worksheet) throw new Error("لم يتم العثور على ورقة بيانات صالحة داخل الملف");
  const matrix = Array.from({ length: worksheet.rowCount }, (_, index) => rowValues(worksheet, index + 1));
  let headerRow = -1;
  let headers: string[] = [];
  let bestScore = 0;
  for (let rowIndex = 0; rowIndex < Math.min(10, matrix.length); rowIndex += 1) {
    const candidate = matrix[rowIndex].map(cellText);
    const score = candidate.reduce(
      (sum, header) =>
        sum +
        (fields.some((field) => fieldAliases[field].some((alias) => headerMatch(header, alias))) ||
        Object.values(NOOR_TEMPLATE_ALIASES).some((aliases) =>
          aliases.some((alias) => headerMatch(header, alias)),
        )
          ? 1
          : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      headerRow = rowIndex;
      headers = candidate;
    }
  }
  if (headerRow < 0 || bestScore < 1)
    throw new Error("تعذر اكتشاف صف عناوين الأعمدة. استخدم ملفًا يحتوي على عناوين واضحة.");
  headers = headers.map((header, index) => header || `عمود ${index + 1}`);
  const { mapping, confidence } = detectMapping(headers, input.mapping);
  const noorTemplate = checkNoorRosterTemplate(headers, mapping);
  const dataRows = matrix.slice(headerRow + 1);
  if (dataRows.length > STAFF_IMPORT_MAX_ROWS)
    throw new Error(`الملف يتجاوز الحد الأعلى البالغ ${STAFF_IMPORT_MAX_ROWS.toLocaleString("ar-SA")} صف`);
  const seen = new Map<string, number>();
  const seenPhones = new Map<string, number>();
  const rows: ParsedStaffRow[] = [];
  let emptyRows = 0;
  let formulaRows = 0;
  for (let index = 0; index < dataRows.length; index += 1) {
    const raw = dataRows[index];
    const rowNumber = headerRow + index + 2;
    if (raw.every((cell) => !cellText(cell))) {
      emptyRows += 1;
      continue;
    }
    const errors: string[] = [];
    const warnings: string[] = [];
    if (rowHasFormula(worksheet, rowNumber)) {
      errors.push("تحتوي الخلية على معادلة غير متوقعة");
      formulaRows += 1;
    }
    if (raw.some((cell) => cellText(cell).length > 500)) errors.push("يوجد نص يتجاوز الحد المسموح");
    if (raw.some((cell) => /^=/.test(cellText(cell)))) errors.push("يوجد محتوى يشبه معادلة Excel");
    const correction = input.corrections?.[String(rowNumber)] ?? {};
    const corrected = (field: StaffField) =>
      correction[field] === null
        ? ""
        : typeof correction[field] === "string"
          ? correction[field]!.trim()
          : mappedValue(raw, headers, mapping, field);
    const fullName = corrected("fullName");
    const nationalId = normalizeNoorUsername(corrected("nationalId"));
    const phoneValue = corrected("phone");
    const phone = phoneValue ? normalizePhone(phoneValue) : null;
    const jobTitle = corrected("jobTitle") || null;
    const specialization = corrected("specialization") || null;
    const emailValue = corrected("email");
    const email = emailValue ? normalizeEmail(emailValue) : null;
    const employeeNumber = corrected("employeeNumber") || null;
    if (!fullName) errors.push("الاسم مطلوب");
    if (fullName.length > 200) errors.push("الاسم طويل جدًا");
    if (!nationalId) errors.push("اسم المستخدم في نور مطلوب");
    if (nationalId && !/^[\p{L}\p{N}._-]{3,64}$/u.test(nationalId))
      errors.push("اسم المستخدم في نور غير صالح");
    if (phone && !/^\+?\d{7,15}$/.test(phone)) errors.push("رقم الجوال غير صالح");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("البريد الإلكتروني غير صالح");
    const nationalIdHash = nationalId ? nationalIdLookupHash(nationalId) : "";
    const duplicateWithinFile = Boolean(nationalIdHash && seen.has(nationalIdHash));
    if (duplicateWithinFile)
      errors.push(`اسم المستخدم في نور مكرر داخل الملف (الصف ${seen.get(nationalIdHash)})`);
    else if (nationalIdHash) seen.set(nationalIdHash, rowNumber);
    const duplicateInSchool = Boolean(nationalIdHash && input.existingIdHashes?.has(nationalIdHash));
    if (duplicateInSchool)
      warnings.push("اسم المستخدم في نور موجود مسبقًا في المدرسة. سيُحدّث السجل الحالي دون إنشاء سجل جديد.");
    const duplicatePhoneWithinFile = Boolean(phone && seenPhones.has(phone!));
    if (duplicatePhoneWithinFile)
      warnings.push(
        `رقم الجوال مكرر داخل الملف (الصف ${seenPhones.get(phone!)}). سيحتاج هذا التعارض إلى مراجعة قبل دخول المعلم.`,
      );
    else if (phone) seenPhones.set(phone, rowNumber);
    const duplicatePhoneInSchool = Boolean(phone && input.existingPhoneHashes?.has(phoneLookupHash(phone!)));
    if (duplicatePhoneInSchool)
      warnings.push(
        "رقم الجوال مستخدم لسجل آخر في المدرسة. لن يُسمح بالدخول الذاتي حتى تُراجع الإدارة التعارض.",
      );
    rows.push({
      rowNumber,
      fullName,
      nationalIdHash,
      nationalIdLast4: nationalId.slice(-4),
      nationalIdComparable: nationalId,
      phone,
      phoneLast4: phone?.slice(-4) ?? null,
      jobTitle,
      specialization,
      email,
      employeeNumber,
      errors,
      warnings,
      reviewFlags: [],
      duplicateWithinFile,
      duplicateInSchool,
      duplicatePhoneWithinFile,
      duplicatePhoneInSchool,
    });
  }
  const invalidRows = rows.filter((row) => row.errors.length > 0).length;
  const validRows = rows.length - invalidRows;
  const duplicateRows = rows.filter((row) => row.duplicateWithinFile || row.duplicateInSchool).length;
  const duplicatePhoneRows = rows.filter(
    (row) => row.duplicatePhoneWithinFile || row.duplicatePhoneInSchool,
  ).length;
  const missingPhoneRows = rows.filter((row) => !row.phone).length;
  const reviewRows = rows.filter((row) => row.warnings.length > 0 || row.duplicateInSchool).length;
  return {
    sheetName: worksheet.name,
    headers,
    mapping,
    confidence,
    needsMapping:
      requiredFields.some((field) => confidence[field] !== "high") ||
      fields.some((field) => confidence[field] === "medium"),
    noorTemplate,
    rows,
    emptyRows,
    formulaRows,
    totalRows: dataRows.length - emptyRows,
    validRows,
    invalidRows,
    duplicateRows,
    duplicatePhoneRows,
    missingPhoneRows,
    reviewRows,
  };
}

export type StaffImportSourceInput = {
  bytes: ArrayBuffer | Uint8Array;
  fileName: string;
  sourceName: string;
};
export type StaffImportSourceSummary = {
  name: string;
  fileName: string;
  extractedCount: number;
  validCount: number;
  reviewCount: number;
};
export type MultiStaffImportAnalysis = StaffImportAnalysis & { sourceSummaries: StaffImportSourceSummary[] };

function similarityText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^a-z0-9\u0621-\u064A]+/g, " ")
    .trim();
}

function compactSimilarityText(value: string) {
  return similarityText(value).replace(/\s+/g, "");
}

function editDistance(first: string, second: string) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    let diagonal = previous[0]!;
    previous[0] = row;
    for (let column = 1; column <= second.length; column += 1) {
      const above = previous[column]!;
      previous[column] = Math.min(
        previous[column]! + 1,
        previous[column - 1]! + 1,
        diagonal + (first[row - 1] === second[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[second.length]!;
}

function similarityScore(first: string, second: string) {
  if (!first || !second) return 0;
  const length = Math.max(first.length, second.length);
  return 1 - editDistance(first, second) / length;
}

function similarName(first: string, second: string) {
  const firstText = similarityText(first);
  const secondText = similarityText(second);
  if (firstText.length < 6 || secondText.length < 6) return 0;
  const score = similarityScore(firstText.replace(/\s/g, ""), secondText.replace(/\s/g, ""));
  const firstTokens = new Set(firstText.split(" ").filter(Boolean));
  const secondTokens = new Set(secondText.split(" ").filter(Boolean));
  const shared = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const tokenScore = shared / Math.max(firstTokens.size, secondTokens.size);
  return score >= 0.84 && (tokenScore >= 0.5 || score >= 0.92) ? Math.max(score, tokenScore) : 0;
}

function similarNumber(first: string | null, second: string | null, minimumLength = 6) {
  if (!first || !second) return 0;
  const firstText = compactSimilarityText(first);
  const secondText = compactSimilarityText(second);
  if (firstText === secondText || firstText.length < minimumLength || secondText.length < minimumLength)
    return 0;
  const score = similarityScore(firstText, secondText);
  const maxDistance = Math.max(1, Math.ceil(Math.max(firstText.length, secondText.length) * 0.1));
  return editDistance(firstText, secondText) <= maxDistance && score >= 0.8 ? score : 0;
}

function similarityMessage(
  kind: StaffSimilarityKind,
  related: ParsedStaffRow,
  score: number,
  sourceName: string,
) {
  const percentage = Math.round(score * 100);
  const location = `${sourceName}، الصف ${related.rowNumber}`;
  if (kind === "NAME_SIMILAR")
    return `الاسم متشابه مع «${related.fullName}» في ${location} (${percentage}٪). راجع السجلين قبل الاعتماد.`;
  if (kind === "PHONE_SIMILAR")
    return `رقم الجوال متشابه مع سجل «${related.fullName}» في ${location} (${percentage}٪). راجع الرقمين.`;
  if (kind === "EMPLOYEE_NUMBER_SIMILAR")
    return `الرقم الوظيفي متشابه مع سجل «${related.fullName}» في ${location} (${percentage}٪). راجع الرقمين.`;
  return `اسم المستخدم في نور متشابه مع سجل «${related.fullName}» في ${location} (${percentage}٪). راجع السجلين.`;
}

function addSimilarityFlag(
  row: ParsedStaffRow,
  related: ParsedStaffRow,
  kind: StaffSimilarityKind,
  score: number,
) {
  const flag: StaffImportReviewFlag = {
    kind,
    confidence: Math.round(score * 100) / 100,
    message: similarityMessage(kind, related, score, related.sourceName ?? "المصدر الآخر"),
    relatedSourceName: related.sourceName ?? "المصدر الآخر",
    relatedRowNumber: related.rowNumber,
    relatedFullName: related.fullName,
    relatedUsernameLast4: related.nationalIdLast4,
    relatedPhoneLast4: related.phoneLast4,
  };
  if (
    row.reviewFlags.some(
      (item) =>
        item.kind === kind &&
        item.relatedSourceName === flag.relatedSourceName &&
        item.relatedRowNumber === flag.relatedRowNumber,
    )
  )
    return;
  row.reviewFlags.push(flag);
  row.warnings.push(flag.message);
}

/** Analyze several official Noor files as one import batch while retaining source attribution. */
export async function analyzeStaffImportSources(input: {
  sources: StaffImportSourceInput[];
  mapping?: StaffMapping;
  corrections?: StaffCorrections;
  existingIdHashes?: Set<string>;
  existingPhoneHashes?: Set<string>;
}): Promise<MultiStaffImportAnalysis> {
  if (input.sources.length < 1 || input.sources.length > STAFF_IMPORT_MAX_FILES) {
    throw new Error(
      `اختر ملفًا واحدًا على الأقل وبحد أقصى ${STAFF_IMPORT_MAX_FILES} ملفًا للاستيراد المتعدد.`,
    );
  }

  const analyzed = await Promise.all(
    input.sources.map(async (source, sourceIndex) => {
      const localCorrections: StaffCorrections = {};
      for (const [key, value] of Object.entries(input.corrections ?? {})) {
        const prefix = `${sourceIndex}:`;
        if (key.startsWith(prefix)) localCorrections[key.slice(prefix.length)] = value;
        else if (sourceIndex === 0 && !key.includes(":")) localCorrections[key] = value;
      }
      const analysis = await analyzeStaffWorkbook({
        bytes: source.bytes,
        fileName: source.fileName,
        mapping: input.mapping,
        corrections: localCorrections,
        existingIdHashes: input.existingIdHashes,
        existingPhoneHashes: input.existingPhoneHashes,
      });
      return { analysis, source, sourceIndex };
    }),
  );

  const rows: ParsedStaffRow[] = [];
  const seenIds = new Map<string, ParsedStaffRow>();
  const seenPhones = new Map<string, ParsedStaffRow>();
  for (const { analysis, source, sourceIndex } of analyzed) {
    for (const original of analysis.rows) {
      const row: ParsedStaffRow = {
        ...original,
        sourceIndex,
        sourceName: source.sourceName,
        errors: [...original.errors],
        warnings: [...original.warnings],
        reviewFlags: [...original.reviewFlags],
      };
      const previousId = row.nationalIdHash ? seenIds.get(row.nationalIdHash) : undefined;
      if (previousId && !row.duplicateWithinFile) {
        row.duplicateWithinFile = true;
        row.errors.push(
          `\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0645\u0643\u0631\u0631 \u0641\u064a \u0645\u0635\u062f\u0631 \u0622\u062e\u0631: ${previousId.sourceName} \u0635\u0641 ${previousId.rowNumber}`,
        );
      } else if (row.nationalIdHash && !previousId) {
        seenIds.set(row.nationalIdHash, row);
      }
      const previousPhone = row.phone ? seenPhones.get(row.phone) : undefined;
      if (previousPhone && !row.duplicatePhoneWithinFile) {
        row.duplicatePhoneWithinFile = true;
        row.warnings.push(
          `\u0631\u0642\u0645 \u0627\u0644\u062c\u0648\u0627\u0644 \u0645\u0648\u062c\u0648\u062f \u0623\u064a\u0636\u064b\u0627 \u0641\u064a \u0645\u0635\u062f\u0631 ${previousPhone.sourceName} \u0635\u0641 ${previousPhone.rowNumber}.`,
        );
      } else if (row.phone && !previousPhone) {
        seenPhones.set(row.phone, row);
      }
      rows.push(row);
    }
  }

  // Fuzzy matching is deliberately limited to different uploaded sources.
  // Exact username/phone duplicates keep their existing validation behavior;
  // near matches are warnings so the manager can review them without losing a record.
  for (let firstIndex = 0; firstIndex < rows.length; firstIndex += 1) {
    const firstRow = rows[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < rows.length; secondIndex += 1) {
      const secondRow = rows[secondIndex]!;
      if (firstRow.sourceIndex === secondRow.sourceIndex) continue;
      if (firstRow.nationalIdHash && firstRow.nationalIdHash === secondRow.nationalIdHash) continue;
      const nameScore = similarName(firstRow.fullName, secondRow.fullName);
      if (nameScore) {
        addSimilarityFlag(firstRow, secondRow, "NAME_SIMILAR", nameScore);
        addSimilarityFlag(secondRow, firstRow, "NAME_SIMILAR", nameScore);
      }
      const usernameScore = similarNumber(
        firstRow.nationalIdComparable ?? null,
        secondRow.nationalIdComparable ?? null,
        3,
      );
      if (usernameScore) {
        addSimilarityFlag(firstRow, secondRow, "USERNAME_SIMILAR", usernameScore);
        addSimilarityFlag(secondRow, firstRow, "USERNAME_SIMILAR", usernameScore);
      }
      const phoneScore =
        firstRow.phone && secondRow.phone && firstRow.phone === secondRow.phone
          ? 1
          : similarNumber(firstRow.phone, secondRow.phone, 7);
      if (phoneScore) {
        addSimilarityFlag(firstRow, secondRow, "PHONE_SIMILAR", phoneScore);
        addSimilarityFlag(secondRow, firstRow, "PHONE_SIMILAR", phoneScore);
      }
      const employeeScore =
        firstRow.employeeNumber &&
        secondRow.employeeNumber &&
        firstRow.employeeNumber === secondRow.employeeNumber
          ? 1
          : similarNumber(firstRow.employeeNumber, secondRow.employeeNumber, 4);
      if (employeeScore) {
        addSimilarityFlag(firstRow, secondRow, "EMPLOYEE_NUMBER_SIMILAR", employeeScore);
        addSimilarityFlag(secondRow, firstRow, "EMPLOYEE_NUMBER_SIMILAR", employeeScore);
      }
    }
  }

  const first = analyzed[0]!.analysis;
  const sourceSummaries = analyzed.map(({ source, sourceIndex }) => ({
    name: source.sourceName,
    fileName: source.fileName,
    extractedCount: rows.filter((row) => row.sourceIndex === sourceIndex).length,
    validCount: rows.filter((row) => row.sourceIndex === sourceIndex && row.errors.length === 0).length,
    reviewCount: rows.filter((row) => row.sourceIndex === sourceIndex && row.reviewFlags.length > 0).length,
  }));
  const noorTemplate: NoorTemplateCheck = {
    ...first.noorTemplate,
    matches: analyzed.every(({ analysis }) => analysis.noorTemplate.matches),
    matchedColumns: [...new Set(analyzed.flatMap(({ analysis }) => analysis.noorTemplate.matchedColumns))],
    missingRequired: [...new Set(analyzed.flatMap(({ analysis }) => analysis.noorTemplate.missingRequired))],
    missingRecommended: [
      ...new Set(analyzed.flatMap(({ analysis }) => analysis.noorTemplate.missingRecommended)),
    ],
    issues: [...new Set(analyzed.flatMap(({ analysis }) => analysis.noorTemplate.issues))],
  };
  const invalidRows = rows.filter((row) => row.errors.length > 0).length;
  return {
    ...first,
    sheetName: "\u0645\u0635\u0627\u062f\u0631 \u0645\u062a\u0639\u062f\u062f\u0629",
    rows,
    noorTemplate,
    needsMapping: analyzed.some(({ analysis }) => analysis.needsMapping),
    emptyRows: analyzed.reduce((sum, item) => sum + item.analysis.emptyRows, 0),
    formulaRows: analyzed.reduce((sum, item) => sum + item.analysis.formulaRows, 0),
    totalRows: analyzed.reduce((sum, item) => sum + item.analysis.totalRows, 0),
    validRows: rows.length - invalidRows,
    invalidRows,
    duplicateRows: rows.filter((row) => row.duplicateWithinFile || row.duplicateInSchool).length,
    duplicatePhoneRows: rows.filter((row) => row.duplicatePhoneWithinFile || row.duplicatePhoneInSchool)
      .length,
    missingPhoneRows: rows.filter((row) => !row.phone).length,
    reviewRows: rows.filter((row) => row.warnings.length > 0 || row.duplicateInSchool).length,
    sourceSummaries,
  };
}

export function exportSafeSpreadsheetValue(value: string | null | undefined) {
  const text = value ?? "";
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
