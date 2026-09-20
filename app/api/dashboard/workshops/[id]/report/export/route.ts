import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { NextResponse } from "next/server";
import { ReportPdfDocument } from "@/src/lib/report-pdf";
import { createReportWorkbook, reportFileName } from "@/src/lib/report-export";
import { db } from "@/src/lib/db";
import { normalizeReportPayload } from "@/src/lib/reporting";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { writeAuditLog } from "@/src/lib/authorization";
import { hasPermission, Permission } from "@/src/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function downloadHeaders(fileName: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Cache-Control": "private, no-store, max-age=0",
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardContext({ permission: Permission.ReportsRead });
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format")?.toLowerCase();
  if (format !== "pdf" && format !== "xlsx") return NextResponse.json({ error: "صيغة التصدير غير مدعومة" }, { status: 400 });

  const report = await db.reportSnapshot.findFirst({ where: { workshopId: id, schoolId: session.membership!.schoolId, immutable: true, workshop: { status: "COMPLETED", deletedAt: null } }, select: { id: true, snapshot: true, metrics: true } });
  if (!report) return NextResponse.json({ error: "التقرير غير متاح أو لم تكتمل الورشة" }, { status: 404 });
  const payload = normalizeReportPayload(report.snapshot ?? report.metrics);
  if (!payload) return NextResponse.json({ error: "بيانات التقرير غير صالحة" }, { status: 422 });

  if (format === "xlsx") {
    const canExportParticipants = hasPermission(session.membership!.role, Permission.ReportsExportParticipants);
    const workbook = await createReportWorkbook({ payload, reportId: report.id, includeParticipants: canExportParticipants });
    await writeAuditLog({ schoolId: session.membership!.schoolId, userId: session.user.id, action: "REPORT_EXPORTED", entity: "ReportSnapshot", entityId: report.id, metadata: { format: "xlsx", includeParticipants: canExportParticipants } });
    return new Response(workbook, { headers: downloadHeaders(reportFileName(payload, "xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") });
  }

  const pdf = await renderToBuffer(createElement(ReportPdfDocument, { payload, reportId: report.id }) as unknown as Parameters<typeof renderToBuffer>[0]);
  await writeAuditLog({ schoolId: session.membership!.schoolId, userId: session.user.id, action: "REPORT_EXPORTED", entity: "ReportSnapshot", entityId: report.id, metadata: { format: "pdf", includeParticipants: false } });
  return new Response(new Uint8Array(pdf), { headers: downloadHeaders(reportFileName(payload, "pdf"), "application/pdf") });
}
