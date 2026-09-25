import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { writeAuditLog } from "@/src/lib/authorization";
import { db } from "@/src/lib/db";
import {
  createProfessionalPlanWorkbook,
  professionalPlanReportFileName,
} from "@/src/lib/professional-growth-plans";
import { ProfessionalGrowthPlanPdfDocument } from "@/src/lib/professional-growth-plan-pdf";
import { Permission } from "@/src/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headers(fileName: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename=\"${fileName}\"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Cache-Control": "private, no-store, max-age=0",
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardContext({ permission: Permission.ReportsRead });
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf")
    return NextResponse.json({ error: "صيغة التصدير غير مدعومة." }, { status: 400 });
  const report = await db.professionalGrowthPlanReportSnapshot.findFirst({
    where: { planId: id, schoolId: session.membership!.schoolId, immutable: true },
    select: { id: true, snapshot: true },
  });
  if (!report) return NextResponse.json({ error: "تقرير الخطة غير متاح." }, { status: 404 });
  const snapshot = report.snapshot as Record<string, unknown>;
  if (format === "xlsx") {
    const workbook = await createProfessionalPlanWorkbook(snapshot);
    await writeAuditLog({
      schoolId: session.membership!.schoolId,
      userId: session.user.id,
      action: "PROFESSIONAL_GROWTH_PLAN_REPORT_EXPORTED",
      entity: "ProfessionalGrowthPlanReportSnapshot",
      entityId: report.id,
      metadata: { format },
    });
    return new Response(workbook, {
      headers: headers(
        professionalPlanReportFileName("xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    });
  }
  const pdf = await renderToBuffer(
    createElement(ProfessionalGrowthPlanPdfDocument, {
      snapshot,
      reportId: report.id,
    }) as unknown as Parameters<typeof renderToBuffer>[0],
  );
  await writeAuditLog({
    schoolId: session.membership!.schoolId,
    userId: session.user.id,
    action: "PROFESSIONAL_GROWTH_PLAN_REPORT_EXPORTED",
    entity: "ProfessionalGrowthPlanReportSnapshot",
    entityId: report.id,
    metadata: { format },
  });
  return new Response(new Uint8Array(pdf), {
    headers: headers(professionalPlanReportFileName("pdf"), "application/pdf"),
  });
}
