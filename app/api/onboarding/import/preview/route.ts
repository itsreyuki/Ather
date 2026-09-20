import { NextResponse } from "next/server";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";
import {
  analyzeStaffWorkbook,
  readStaffImportFile,
  STAFF_IMPORT_MAX_PREVIEW_ROWS,
  type StaffCorrections,
  type StaffMapping,
} from "@/src/lib/staff-import";

export const runtime = "nodejs";

function preview(analysis: Awaited<ReturnType<typeof analyzeStaffWorkbook>>) {
  const validRows = analysis.rows.filter((row) => row.errors.length === 0 && row.nationalIdHash);
  const firstRows = analysis.rows.slice(0, STAFF_IMPORT_MAX_PREVIEW_ROWS);
  const issueRows = analysis.rows.filter((row) => row.errors.length > 0 || row.warnings.length > 0).slice(0, 200);
  const rows = [...new Map([...firstRows, ...issueRows].map((row) => [row.rowNumber, row])).values()];
  return {
    ...analysis,
    diff: {
      newCount: validRows.filter((row) => !row.duplicateInSchool).length,
      updatedCount: validRows.filter((row) => row.duplicateInSchool).length,
      conflictCount: analysis.rows.filter((row) => row.errors.length > 0).length,
    },
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      fullName: row.fullName,
      nationalIdLast4: row.nationalIdLast4,
      phoneLast4: row.phoneLast4,
      jobTitle: row.jobTitle,
      specialization: row.specialization,
      email: row.email,
      errors: row.errors,
      warnings: row.warnings,
      duplicateWithinFile: row.duplicateWithinFile,
      duplicateInSchool: row.duplicateInSchool,
      duplicatePhoneWithinFile: row.duplicatePhoneWithinFile,
      duplicatePhoneInSchool: row.duplicatePhoneInSchool,
      issues: [...row.errors, ...row.warnings],
    })),
    issueRowsTruncated: analysis.rows.filter((row) => row.errors.length > 0 || row.warnings.length > 0).length > 200,
  };
}

function parseCorrections(value: FormDataEntryValue | null): StaffCorrections | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("تصحيحات الملف غير صالحة");
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
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 });
    const mapping = form.get("mapping")
      ? (JSON.parse(String(form.get("mapping"))) as StaffMapping)
      : undefined;
    const corrections = parseCorrections(form.get("corrections"));
    const stored = await readStaffImportFile(file);
    const existing = await db.staffMember.findMany({
      where: { schoolId: session.membership.schoolId },
      select: { nationalIdHash: true, phoneLookupHash: true },
    });
    const analysis = await analyzeStaffWorkbook({
      ...stored,
      mapping,
      corrections,
      existingIdHashes: new Set(existing.map((item) => item.nationalIdHash)),
      existingPhoneHashes: new Set(
        existing.flatMap((item) => (item.phoneLookupHash ? [item.phoneLookupHash] : [])),
      ),
    });
    return NextResponse.json({ fileName: stored.fileName, ...preview(analysis) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تحليل الملف" },
      { status: 400 },
    );
  }
}
