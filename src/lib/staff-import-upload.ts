import { createHash } from "node:crypto";
import {
  readStaffImportFile,
  STAFF_IMPORT_MAX_FILES,
  STAFF_IMPORT_MAX_TOTAL_BYTES,
  type StaffImportSourceInput,
} from "./staff-import";

export type StaffImportUpload =
  | { mode: "single"; fileName: string; source: Awaited<ReturnType<typeof readStaffImportFile>> }
  | { mode: "multiple"; fileName: string; sources: StaffImportSourceInput[] };

export async function readStaffImportUpload(form: FormData): Promise<StaffImportUpload> {
  const multiValues = form.getAll("files");
  const singleValue = form.get("file");
  if (multiValues.length && singleValue)
    throw new Error("استخدم خيار رفع ملف واحد أو عدة ملفات، وليس الخيارين معًا.");

  if (!multiValues.length) {
    if (!(singleValue instanceof File)) throw new Error("لم يتم اختيار ملف");
    const source = await readStaffImportFile(singleValue);
    return { mode: "single", fileName: source.fileName, source };
  }

  if (multiValues.length < 1 || multiValues.length > STAFF_IMPORT_MAX_FILES) {
    throw new Error(
      `\u064a\u062c\u0628 \u0627\u062e\u062a\u064a\u0627\u0631 \u0645\u0644\u0641 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0648\u0628\u062d\u062f \u0623\u0642\u0635\u0649 ${STAFF_IMPORT_MAX_FILES} \u0645\u0644\u0641\u064b\u0627.`,
    );
  }
  if (multiValues.some((value) => !(value instanceof File)))
    throw new Error("أحد الملفات المرفوعة غير صالح.");
  if ((multiValues as File[]).some((file) => !file.name.toLowerCase().endsWith(".pdf"))) {
    throw new Error(
      "\u0631\u0641\u0639 \u0639\u062f\u0629 \u0645\u0644\u0641\u0627\u062a \u064a\u062f\u0639\u0645 \u062a\u0642\u0627\u0631\u064a\u0631 PDF \u0627\u0644\u0631\u0633\u0645\u064a\u0629 \u0645\u0646 \u0646\u0638\u0627\u0645 \u0646\u0648\u0631 \u0641\u0642\u0637.",
    );
  }

  const files = multiValues as File[];
  let names: unknown;
  try {
    names = JSON.parse(String(form.get("sourceNames") ?? ""));
  } catch {
    throw new Error("تعذر قراءة أسماء مصادر الملفات.");
  }
  if (
    !Array.isArray(names) ||
    names.length !== files.length ||
    names.some((name) => typeof name !== "string" || !name.trim() || name.trim().length > 80)
  ) {
    throw new Error("أدخل اسمًا واضحًا لكل مصدر، بحد أقصى 80 حرفًا.");
  }

  const sources: StaffImportSourceInput[] = [];
  const fingerprints = new Set<string>();
  let totalBytes = 0;
  for (const [index, file] of files.entries()) {
    const stored = await readStaffImportFile(file);
    totalBytes += stored.bytes.byteLength;
    if (totalBytes > STAFF_IMPORT_MAX_TOTAL_BYTES)
      throw new Error("إجمالي حجم الملفات يتجاوز الحد المسموح (50MB).");
    const fingerprint = createHash("sha256").update(Buffer.from(stored.bytes)).digest("hex");
    if (fingerprints.has(fingerprint))
      throw new Error(`الملف «${file.name}» مكرر في أكثر من عنصر. ارفع كل ملف مرة واحدة فقط.`);
    fingerprints.add(fingerprint);
    sources.push({ ...stored, sourceName: (names[index] as string).trim() });
  }
  return {
    mode: "multiple",
    fileName: sources
      .map((source) => source.sourceName)
      .join("، ")
      .slice(0, 255),
    sources,
  };
}
