"use client";

import { Download, FileSpreadsheet, Printer } from "lucide-react";

export function ReportExportActions({ workshopId }: { workshopId: string }) {
  const exportUrl = (format: "pdf" | "xlsx") => `/api/dashboard/workshops/${encodeURIComponent(workshopId)}/report/export?format=${format}`;
  return <div className="report-export-actions" aria-label="خيارات التقرير">
    <a className="button button-secondary" href={exportUrl("pdf")}><Download size={15} /> تحميل PDF</a>
    <a className="button button-secondary" href={exportUrl("xlsx")}><FileSpreadsheet size={15} /> تحميل Excel</a>
    <button className="button button-primary" type="button" onClick={() => window.print()}><Printer size={15} /> طباعة التقرير</button>
  </div>;
}
