import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

Font.register({
  family: "NotoArabicPlan",
  src: path.join(
    process.cwd(),
    "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff",
  ),
  fontWeight: 400,
});
Font.register({
  family: "NotoArabicPlan",
  src: path.join(
    process.cwd(),
    "node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff",
  ),
  fontWeight: 700,
});

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "NotoArabicPlan",
    fontSize: 9,
    color: "#17221d",
    backgroundColor: "#fff",
    direction: "rtl",
  },
  header: { borderBottom: "1pt solid #dce7e1", paddingBottom: 13, marginBottom: 16 },
  brand: { color: "#168657", fontSize: 19, fontWeight: 700 },
  title: { color: "#123b29", fontSize: 16, fontWeight: 700, marginTop: 8 },
  muted: { color: "#607168", marginTop: 3, fontSize: 8 },
  metrics: { flexDirection: "row", gap: 8, marginBottom: 18 },
  metric: { flex: 1, padding: 8, border: "1pt solid #dce7e1", borderRadius: 5, backgroundColor: "#f8fbf9" },
  metricLabel: { color: "#607168", fontSize: 7 },
  metricValue: { color: "#168657", fontSize: 14, fontWeight: 700, marginTop: 4 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#123b29", marginBottom: 7 },
  table: { border: "1pt solid #dce7e1", borderRadius: 4 },
  row: { flexDirection: "row", minHeight: 24, alignItems: "center", borderBottom: "1pt solid #e5ede8" },
  headerRow: { backgroundColor: "#edf6f1" },
  cell: { width: "14%", padding: 5, textAlign: "center", fontSize: 7 },
  titleCell: { width: "30%", padding: 5, textAlign: "right", fontSize: 7 },
  note: {
    marginTop: 18,
    padding: 9,
    backgroundColor: "#f5f8f6",
    color: "#52665b",
    fontSize: 7,
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    textAlign: "center",
    color: "#728279",
    fontSize: 7,
  },
});

function value(value: unknown, suffix = "") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)}${suffix}`
    : "—";
}

export function ProfessionalGrowthPlanPdfDocument({
  snapshot,
  reportId,
}: {
  snapshot: Record<string, unknown>;
  reportId: string;
}) {
  const plan = (snapshot.plan ?? {}) as Record<string, unknown>;
  const school = (snapshot.school ?? {}) as Record<string, unknown>;
  const summary = (snapshot.summary ?? {}) as Record<string, unknown>;
  const programs = (snapshot.programs ?? []) as Array<Record<string, unknown>>;
  return (
    <Document title={`تقرير خطة النمو المهني - ${String(plan.title ?? "")}`} author="ATHAR" language="ar-SA">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>أثر · ATHAR</Text>
          <Text style={styles.title}>تقرير خطة النمو المهني</Text>
          <Text style={styles.muted}>
            {String(school.name ?? "المدرسة")} · {String(plan.title ?? "الخطة")} ·{" "}
            {String(plan.periodLabel ?? "")}
          </Text>
          <Text style={styles.muted}>رقم التقرير: {reportId}</Text>
        </View>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>عدد البرامج</Text>
            <Text style={styles.metricValue}>{value(summary.programCount)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>البرامج المكتملة</Text>
            <Text style={styles.metricValue}>{value(summary.completedProgramCount)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>متوسط مؤشر الأثر</Text>
            <Text style={styles.metricValue}>{value(summary.averageImpact, "%")}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>متوسط استجابة المشاركين</Text>
            <Text style={styles.metricValue}>{value(summary.averageTeacherResponseRate, "%")}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>برامج الخطة</Text>
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={styles.titleCell}>البرنامج</Text>
              <Text style={styles.cell}>النوع</Text>
              <Text style={styles.cell}>المنفذ</Text>
              <Text style={styles.cell}>الحالة</Text>
              <Text style={styles.cell}>الأثر</Text>
              <Text style={styles.cell}>التحسن</Text>
              <Text style={styles.cell}>الاستجابة</Text>
            </View>
            {programs.map((program) => (
              <View style={styles.row} key={String(program.id)}>
                <Text style={styles.titleCell}>{String(program.title ?? "—")}</Text>
                <Text style={styles.cell}>{String(program.programTypeLabel ?? "—")}</Text>
                <Text style={styles.cell}>{String(program.facilitator ?? "—")}</Text>
                <Text style={styles.cell}>{String(program.status ?? "—")}</Text>
                <Text style={styles.cell}>{value(program.impact, "%")}</Text>
                <Text style={styles.cell}>{value(program.scaleImprovement, "%")}</Text>
                <Text style={styles.cell}>{value(program.teacherResponseRate, "%")}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.note}>{String(snapshot.methodology ?? "")}</Text>
        <Text fixed style={styles.footer}>
          أثر ATHAR · تقرير خطة نمو مهني ثابت · {reportId}
        </Text>
      </Page>
    </Document>
  );
}
