import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportPayload } from "./reporting";

Font.register({ family: "NotoArabic", src: path.join(process.cwd(), "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff"), fontWeight: 400 });
Font.register({ family: "NotoArabic", src: path.join(process.cwd(), "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff"), fontWeight: 700 });

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 42, paddingHorizontal: 30, fontFamily: "NotoArabic", fontSize: 9, color: "#17221d", backgroundColor: "#ffffff", direction: "rtl" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 15, borderBottom: "1pt solid #dce7e1" },
  logo: { flexDirection: "row", alignItems: "center", gap: 7 },
  logoMark: { width: 28, height: 28, borderRadius: 7, backgroundColor: "#26b879", color: "#06120d", textAlign: "center", paddingTop: 5, fontSize: 15, fontWeight: 700 },
  logoText: { fontSize: 14, fontWeight: 700, lineHeight: 1.1 },
  logoLatin: { color: "#6b7b73", fontFamily: "Helvetica", fontSize: 6, letterSpacing: 1.6 },
  headerTitle: { textAlign: "left", fontSize: 17, fontWeight: 700, color: "#123b29" },
  headerMeta: { textAlign: "left", color: "#6b7b73", fontSize: 8, marginTop: 3 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#123b29", marginBottom: 8 },
  sectionNote: { color: "#6b7b73", fontSize: 8, marginBottom: 8 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  infoItem: { width: "31%", minWidth: 0, minHeight: 38, border: "1pt solid #e1ebe6", borderRadius: 5, padding: 7 },
  infoLabel: { color: "#73837b", fontSize: 7, marginBottom: 3 },
  infoValue: { fontSize: 9, fontWeight: 700 },
  metricGrid: { flexDirection: "row", gap: 7 },
  metric: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, border: "1pt solid #dce7e1", borderRadius: 6, padding: 8, minHeight: 58, backgroundColor: "#f8fbf9" },
  metricLabel: { color: "#6b7b73", fontSize: 7, marginBottom: 5 },
  metricValue: { color: "#168657", fontSize: 15, fontWeight: 700 },
  metricDetail: { color: "#73837b", fontSize: 7, marginTop: 2 },
  chart: { border: "1pt solid #e1ebe6", borderRadius: 6, padding: 9 },
  chartLegend: { flexDirection: "row", gap: 13, marginBottom: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4, color: "#53645c", fontSize: 7 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  chartRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  chartName: { width: "27%", minWidth: 0, fontSize: 7, textAlign: "right" },
  chartBars: { width: "73%", minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  barTrack: { flex: 1, height: 9, backgroundColor: "#edf3ef", borderRadius: 2, overflow: "hidden" },
  bar: { height: 9, borderRadius: 2 },
  preBar: { backgroundColor: "#426fb8" },
  postBar: { backgroundColor: "#26b879" },
  table: { border: "1pt solid #dce7e1", borderRadius: 5, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderBottom: "1pt solid #e1ebe6", minHeight: 24, alignItems: "center" },
  tableHeader: { backgroundColor: "#edf6f1", fontWeight: 700 },
  cellName: { width: "30%", minWidth: 0, padding: 5, textAlign: "right", fontSize: 7 },
  cell: { width: "11.6%", minWidth: 0, padding: 5, textAlign: "center", fontSize: 7 },
  feedbackGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  feedbackItem: { width: "23%", minWidth: 0, border: "1pt solid #dce7e1", borderRadius: 5, padding: 7 },
  methodology: { marginTop: 18, padding: 9, borderRadius: 5, backgroundColor: "#f5f8f6", color: "#5f7168", fontSize: 7, lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 19, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", color: "#83918a", fontSize: 7 },
});

function value(value: number | null | undefined, suffix = "") {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function date(value: string | null | undefined) {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "غير محدد" : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function metric(label: string, metricValue: string, detail: string) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{metricValue}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

function barWidth(score: number | null) {
  return `${Math.max(0, Math.min(100, (score ?? 0) / 5 * 100))}%`;
}

export function ReportPdfDocument({ payload, reportId }: { payload: ReportPayload; reportId: string }) {
  const workshop = payload.workshop;
  const school = payload.school;
  return <Document title={`تقرير أثر - ${workshop?.title ?? "ورشة"}`} author="ATHAR" language="ar-SA"><Page size="A4" style={styles.page} wrap>
    <View style={styles.header}>
      <View style={styles.logo}><Text style={styles.logoMark}>أ</Text><View><Text style={styles.logoText}>أثر</Text><Text style={styles.logoLatin}>ATHAR</Text></View></View>
      <View><Text style={styles.headerTitle}>تقرير أثر الورشة</Text><Text style={styles.headerMeta}>رقم التقرير: {reportId}</Text><Text style={styles.headerMeta}>تاريخ الإصدار: {date(payload.generatedAt)}</Text></View>
    </View>

    <View style={styles.section}><Text style={styles.sectionTitle}>معلومات التقرير</Text><View style={styles.infoGrid}>
      <View style={styles.infoItem}><Text style={styles.infoLabel}>المدرسة</Text><Text style={styles.infoValue}>{school?.name ?? "غير محدد"}</Text></View>
      <View style={styles.infoItem}><Text style={styles.infoLabel}>الورشة</Text><Text style={styles.infoValue}>{workshop?.title ?? "غير محدد"}</Text></View>
      <View style={styles.infoItem}><Text style={styles.infoLabel}>مقدم الورشة</Text><Text style={styles.infoValue}>{workshop?.facilitator ?? "غير محدد"}</Text></View>
      <View style={styles.infoItem}><Text style={styles.infoLabel}>الفترة</Text><Text style={styles.infoValue}>{date(workshop?.startsAt)} — {date(workshop?.endsAt)}</Text></View>
      <View style={styles.infoItem}><Text style={styles.infoLabel}>المجال</Text><Text style={styles.infoValue}>{workshop?.category ?? "غير مصنف"}</Text></View>
      <View style={styles.infoItem}><Text style={styles.infoLabel}>عدد المشاركين</Text><Text style={styles.infoValue}>{value(payload.participantCount)}</Text></View>
    </View></View>

    <View style={styles.section}><Text style={styles.sectionTitle}>المؤشرات الرئيسية</Text><View style={styles.metricGrid}>
      {metric("المتوسط القبلي", value(payload.aggregates.weightedPreScore), "من 5")}
      {metric("المتوسط البعدي", value(payload.aggregates.weightedPostScore), "من 5")}
      {metric("مقدار التحسن", value(payload.aggregates.weightedDelta), "نقاط")}
      {metric("مؤشر الأثر", value(payload.aggregates.overallScaleImprovementPercentage, "%"), "تحسن على المقياس")}
      {metric("استجابة المتدربين", value(payload.teacherAggregates.responseRatePercentage, "%"), `${value(payload.teacherAggregates.responseCount)} رد`)}
    </View></View>

    <View style={styles.section}><Text style={styles.sectionTitle}>مقارنة القبلي والبعدي حسب المعيار</Text><View style={styles.chart}>
      <View style={styles.chartLegend}><Text style={styles.legendItem}><Text style={[styles.legendDot, styles.preBar]}> </Text> القبلي</Text><Text style={styles.legendItem}><Text style={[styles.legendDot, styles.postBar]}> </Text> البعدي</Text></View>
      {payload.criteria.map((criterion) => <View style={styles.chartRow} key={criterion.criterionId}><Text style={styles.chartName}>{criterion.name}</Text><View style={styles.chartBars}><View style={styles.barTrack}><View style={[styles.bar, styles.preBar, { width: barWidth(criterion.preAverage) }]} /></View><Text style={{ width: 22, fontSize: 6, color: "#426fb8" }}>{value(criterion.preAverage)}</Text><View style={styles.barTrack}><View style={[styles.bar, styles.postBar, { width: barWidth(criterion.postAverage) }]} /></View><Text style={{ width: 22, fontSize: 6, color: "#168657" }}>{value(criterion.postAverage)}</Text></View></View>)}
    </View></View>

    <View style={styles.section}><Text style={styles.sectionTitle}>نتائج المعايير</Text><View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}><Text style={styles.cellName}>المعيار</Text><Text style={styles.cell}>الوزن</Text><Text style={styles.cell}>القبلي</Text><Text style={styles.cell}>البعدي</Text><Text style={styles.cell}>الفرق</Text><Text style={styles.cell}>التحسن</Text><Text style={styles.cell}>الحالة</Text></View>
      {payload.criteria.map((criterion) => <View style={styles.tableRow} key={criterion.criterionId}><Text style={styles.cellName}>{criterion.name}</Text><Text style={styles.cell}>{value(criterion.weight, "%")}</Text><Text style={styles.cell}>{value(criterion.preAverage)}</Text><Text style={styles.cell}>{value(criterion.postAverage)}</Text><Text style={styles.cell}>{value(criterion.delta)}</Text><Text style={styles.cell}>{value(criterion.scaleImprovementPercentage, "%")}</Text><Text style={styles.cell}>{criterion.delta === null ? "غير مكتمل" : criterion.delta > 0 ? "تحسن" : criterion.delta < 0 ? "متابعة" : "ثابت"}</Text></View>)}
    </View></View>

    <View style={styles.section} break><Text style={styles.sectionTitle}>رأي المشاركين</Text><Text style={styles.sectionNote}>هذه المؤشرات مستقلة عن القياس القبلي/البعدي.</Text><View style={styles.feedbackGrid}>
      {metric("معدل الاستجابة", value(payload.teacherAggregates.responseRatePercentage, "%"), `${value(payload.teacherAggregates.responseCount)} رد`)}
      {metric("متوسط التقييم", value(payload.teacherAggregates.evaluationAverage), "من 5")}
      {metric("مؤشر الرضا", value(payload.teacherAggregates.satisfactionIndex, "%"), "من 100")}
      {metric("قابلية التطبيق", value(payload.teacherAggregates.applicabilityAverage), "من 5")}
      {metric("جودة المحتوى", value(payload.teacherAggregates.contentQualityAverage), "من 5")}
      {metric("جودة التقديم", value(payload.teacherAggregates.deliveryQualityAverage), "من 5")}
    </View></View>

    <Text style={styles.methodology}>ملاحظة منهجية: المؤشرات الواردة في هذا التقرير ناتجة عن مقارنة القياس القبلي والبعدي وتقييمات المشاركين المحفوظة عند اعتماد الورشة. لا تمثل هذه المؤشرات إثباتًا لعلاقة سببية، ولا تعتمد على بيانات قابلة للتغيير بعد إصدار التقرير.</Text>
    <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `أثر ATHAR · تقرير ثابت ${reportId}                         صفحة ${pageNumber} من ${totalPages}`} />
  </Page></Document>;
}
