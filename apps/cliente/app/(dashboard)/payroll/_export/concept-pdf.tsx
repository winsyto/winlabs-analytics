import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtInt, monthLabel, monthShort } from "../../_dashboard-kit/format";
import { PROCESS_TYPE_LABELS } from "../_data/detail-queries";
import { MIN_PERSONS } from "../_data/types";
import { fmtMoney, fmtMoneyDiff, fmtShare } from "../_components/format";
import { CONCEPT_NOTES, type ConceptKpiRow, type ConceptReport } from "./concept-report";

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontSize: 8.5, fontFamily: "Helvetica", color: "#111214" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 5 },
  muted: { color: "#6b7280" },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaKey: { width: 120, fontFamily: "Helvetica-Bold" },
  metaVal: { flex: 1 },
  th: { flexDirection: "row", backgroundColor: "#1e2530", color: "#ffffff", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e5e0" },
  cell: { paddingVertical: 3, paddingHorizontal: 4 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", color: "#6b7280", fontSize: 7.5 },
  note: { color: "#6b7280", fontSize: 7.5, marginTop: 2 },
});

const ascii = (t: string) => t.replace(/−/g, "-");
const PRIVATE = `reservado (< ${MIN_PERSONS} personas)`;

interface Col {
  label: string;
  w: number;
  right?: boolean;
}

function Table({ cols, rows, fixedHeader }: { cols: Col[]; rows: string[][]; fixedHeader?: boolean }) {
  return (
    <View>
      <View style={s.th} fixed={fixedHeader}>
        {cols.map((c) => (
          <Text key={c.label} style={[s.cell, { width: `${c.w}%`, textAlign: c.right ? "right" : "left" }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {r.map((v, j) => (
            <Text key={j} style={[s.cell, { width: `${cols[j]!.w}%`, textAlign: cols[j]!.right ? "right" : "left" }]}>
              {ascii(v)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Footer({ report }: { report: ConceptReport }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {report.tenantName} · Payroll · detalle por concepto · exportado {report.exportedAt}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function ConceptPdf({ report }: { report: ConceptReport }) {
  const { data } = report;
  const { period, currency, detail, overview } = data;
  const money = (n: number | null) => (n === null ? "-" : fmtMoney(n, currency));
  const fmtK = (k: ConceptKpiRow, n: number | null) =>
    n === null ? "-" : k.kind === "money" ? money(n) : k.kind === "pct" ? fmtShare(n) : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);
  const fmtD = (k: ConceptKpiRow) => {
    if (k.value === null || k.prev === null) return "-";
    const d = k.value - k.prev;
    return k.kind === "money" ? fmtMoneyDiff(d, currency) : `${d > 0 ? "+" : d < 0 ? "-" : ""}${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(Math.abs(d))}`;
  };

  return (
    <Document title={`Payroll - detalle por concepto - ${report.tenantName}`} author="WinLabs Analytics">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{detail ? `${detail.concept.code} - ${detail.concept.name}` : "Detalle por concepto"}</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>{report.tenantName}</Text>
        {[["Exportado", report.exportedAt], ["Ultima liquidacion", monthLabel(data.freshness.refMonth, "long")], ...report.filterLines.map((l) => [l.label, l.value])].map(([k, v]) => (
          <View key={k} style={s.metaRow}>
            <Text style={s.metaKey}>{k}</Text>
            <Text style={s.metaVal}>{v}</Text>
          </View>
        ))}

        {overview ? (
          <>
            <Text style={s.h2}>Conceptos del periodo</Text>
            {overview.length === 0 ? (
              <Text style={s.muted}>No hay importes en el periodo.</Text>
            ) : (
              <Table
                cols={[
                  { label: "Codigo", w: 16 },
                  { label: "Concepto", w: 32 },
                  { label: "Clase", w: 20 },
                  { label: "Personas", w: 10, right: true },
                  { label: "Importe", w: 22, right: true },
                ]}
                rows={overview.map((r) => [r.code, r.name, r.className ?? "-", fmtInt(r.persons), r.amount === null ? PRIVATE : money(r.amount)])}
                fixedHeader
              />
            )}
          </>
        ) : detail ? (
          <>
            {report.kpiRows.length > 0 && (
              <>
                <Text style={s.h2}>Indicadores</Text>
                <Table
                  cols={[
                    { label: "Indicador", w: 32 },
                    { label: "Valor", w: 20, right: true },
                    { label: `Anterior (${period.compareLabel.replace("vs ", "")})`, w: 22, right: true },
                    { label: "Variacion", w: 16, right: true },
                    { label: "Ref.", w: 10 },
                  ]}
                  rows={report.kpiRows.map((k) => [k.label, fmtK(k, k.value), fmtK(k, k.prev), fmtD(k), k.note || "-"])}
                />
              </>
            )}
            {detail.restricted && <Text style={s.note}>Con estos filtros hay menos de {MIN_PERSONS} personas por mes: los importes se reservan por privacidad.</Text>}
            <Text style={s.h2}>Evolucion (ultimos 12 meses)</Text>
            <Table
              cols={[
                { label: "Mes", w: 25 },
                { label: "Importe", w: 40, right: true },
                { label: "Personas", w: 35, right: true },
              ]}
              rows={detail.series.map((p) => [monthShort(p.month), p.state === "ok" ? money(p.amount) : p.state === "nodata" ? "sin datos" : PRIVATE, p.state === "ok" ? fmtInt(p.persons) : "-"])}
            />
            {detail.processes.length > 0 && (
              <View wrap={false}>
                <Text style={s.h2}>Por proceso</Text>
                <Table
                  cols={[
                    { label: "Mes", w: 12 },
                    { label: "Proceso", w: 30 },
                    { label: "Tipo", w: 20 },
                    { label: "Personas", w: 12, right: true },
                    { label: "Importe", w: 26, right: true },
                  ]}
                  rows={detail.processes.map((r) => [r.month.slice(0, 7), r.code, PROCESS_TYPE_LABELS[r.type] ?? r.type, fmtInt(r.persons), r.amount === null ? PRIVATE : money(r.amount)])}
                />
              </View>
            )}
            {detail.dimensions.map((d) => (
              <View key={d.code} wrap={false}>
                <Text style={s.h2}>Importe medio por {d.name.toLowerCase()}</Text>
                {d.items.length === 0 ? (
                  <Text style={s.muted}>Sin datos.</Text>
                ) : (
                  <Table
                    cols={[
                      { label: "Unidad", w: 34 },
                      { label: "Importe medio", w: 24, right: true },
                      { label: "Importe total", w: 26, right: true },
                      { label: "Personas", w: 16, right: true },
                    ]}
                    rows={d.items.map((i) => [i.label, i.cost === null ? PRIVATE : money(i.cost), i.total === null ? "-" : money(i.total), fmtInt(i.persons)])}
                  />
                )}
              </View>
            ))}
          </>
        ) : null}
        {CONCEPT_NOTES.map((n) => (
          <Text key={n} style={s.note}>
            • {n}
          </Text>
        ))}
        <Footer report={report} />
      </Page>
    </Document>
  );
}
