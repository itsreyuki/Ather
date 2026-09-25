import { NextResponse } from "next/server";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import {
  analyzeStaffImportSources,
  analyzeStaffWorkbook,
  STAFF_IMPORT_MAX_PREVIEW_ROWS,
  type StaffCorrections,
  type StaffMapping,
} from "@/src/lib/staff-import";
import { readStaffImportUpload } from "@/src/lib/staff-import-upload";

export const runtime = "nodejs";

function preview(analysis: Awaited<ReturnType<typeof analyzeStaffWorkbook>>) {
  const validRows = analysis.rows.filter((row) => row.errors.length === 0 && row.nationalIdHash);
  const firstRows = analysis.rows.slice(0, STAFF_IMPORT_MAX_PREVIEW_ROWS);
  const issueRows = analysis.rows
    .filter((row) => row.errors.length > 0 || row.warnings.length > 0)
    .slice(0, 200);
  const rows = [
    ...new Map(
      [...firstRows, ...issueRows].map((row) => [`${row.sourceIndex ?? 0}:${row.rowNumber}`, row]),
    ).values(),
  ];
  return {
    ...analysis,
    diff: {
      newCount: validRows.filter((row) => !row.duplicateInSchool).length,
      updatedCount: validRows.filter((row) => row.duplicateInSchool).length,
      conflictCount: analysis.rows.filter((row) => row.errors.length > 0).length,
    },
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      sourceIndex: row.sourceIndex,
      sourceName: row.sourceName,
      format: row.format,
      fullName: row.fullName,
      nationalIdLast4: row.nationalIdLast4,
      phoneLast4: row.phoneLast4,
      jobTitle: row.jobTitle,
      specialization: row.specialization,
      email: row.email,
      educationAdministration: row.educationAdministration,
      sourceSchoolName: row.sourceSchoolName,
      errors: row.errors,
      warnings: row.warnings,
      reviewFlags: row.reviewFlags,
      duplicateWithinFile: row.duplicateWithinFile,
      duplicateInSchool: row.duplicateInSchool,
      duplicatePhoneWithinFile: row.duplicatePhoneWithinFile,
      duplicatePhoneInSchool: row.duplicatePhoneInSchool,
      issues: [...row.errors, ...row.warnings],
    })),
    issueRowsTruncated:
      analysis.rows.filter((row) => row.errors.length > 0 || row.warnings.length > 0).length > 200,
  };
}

function parseCorrections(value: FormDataEntryValue | null): StaffCorrections | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("تصحيحات الملف غير صالحة");
  return parsed as StaffCorrections;
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  if (!session.membership) return NextResponse.json({ error: "أكمل إعداد المدرسة أولًا" }, { status: 409 });
  const denied = assertApiPermission(session, Permission.StaffWrite);
  if (denied) return denied;
  try {
    const form = await request.formData();
    const mapping = form.get("mapping")
      ? (JSON.parse(String(form.get("mapping"))) as StaffMapping)
      : undefined;
    const corrections = parseCorrections(form.get("corrections"));
    const upload = await readStaffImportUpload(form);
    const existing = await db.staffMember.findMany({
      where: { schoolId: session.membership.schoolId },
      select: { nationalIdHash: true, phoneLookupHash: true },
    });
    const existingIdHashes = new Set(existing.map((item) => item.nationalIdHash));
    const existingPhoneHashes = new Set(
      existing.flatMap((item) => (item.phoneLookupHash ? [item.phoneLookupHash] : [])),
    );
    const analysis =
      upload.mode === "single"
        ? await analyzeStaffWorkbook({
            ...upload.source,
            mapping,
            corrections,
            existingIdHashes,
            existingPhoneHashes,
          })
        : await analyzeStaffImportSources({
            sources: upload.sources,
            mapping,
            corrections,
            existingIdHashes,
            existingPhoneHashes,
          });
    return NextResponse.json({ fileName: upload.fileName, ...preview(analysis) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تحليل الملف" },
      { status: 400 },
    );
  }
}
