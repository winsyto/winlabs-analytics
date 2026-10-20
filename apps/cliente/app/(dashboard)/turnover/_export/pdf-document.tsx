import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtDate, fmtDec, fmtInt, fmtTenure, monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import type { BajaRow } from "../_data/detail-queries";
import type { ReasonItem } from "../_data/types";
import { fmtPct, fmtPp } from "../_components/format";
import { NOTES, type KpiRow, type Report } from "./report";

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

function Footer({ report }: { report: Report }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {report.tenantName} · Rotación · exportado {report.exportedAt}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

const fmtKpi = (k: KpiRow, n: number | null) => (n === null ? "-" : k.kind === "pct" ? fmtPct(n) : fmtInt(n));
const fmtDiff = (k: KpiRow) => {
  if (k.value === null || k.prev === null) return "-";
  const d = k.value - k.prev;
  if (k.kind === "pct") return fmtPp(d);
  const sign = d > 0 ? "+" : d < 0 ? "-" : "";
  return `${sign}${fmtInt(Math.abs(d))}`;
};

const reasonRows = (items: ReasonItem[]) => items.map((i) => [i.label, fmtInt(i.count), `${fmtDec(i.share)}%`]);

function bajaRows(rows: BajaRow[], dims: Dimension[]) {
  return rows.map((r) => [
    r.name,
    r.code,
    ...dims.map((d) => r.units[d.code] ?? "-"),
    fmtDate(r.terminationDate),
    r.reason,
    r.category,
    fmtTenure(r.tenureMonths),
  ]);
}

export function TurnoverPdf({ report }: { report: Report }) {
  const { overview } = report;
  const { freshness, period, kpis } = overview;
  const dims = report.dimensions;
  const dimW = dims.length ? 32 / dims.length : 0;

  return (
    <Document title={`Rotación - ${report.tenantName}`} author="WinLabs Analytics">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Rotación de personal</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>{report.tenantName}</Text>

        {[
          ["Exportado", report.exportedAt],
          ["Datos al cierre de", monthLabel(freshness.refMonth, "long")],
          ["Cierres desde", monthLabel(freshness.firstMonth)],
          ["Headcount promedio", overview.avgHeadcount === null ? "-" : fmtDec(overview.avgHeadcount)],
          ...report.filterLines.map((l) => [l.label, l.value]),
        ].map(([k, v]) => (
          <View key={k} style={s.metaRow}>
            <Text style={s.metaKey}>{k}</Text>
            <Text style={s.metaVal}>{v}</Text>
          </View>
        ))}

        <Text style={s.h2}>Indicadores</Text>
        <Table
          cols={[
            { label: "Indicador", w: 28 },
            { label: "Valor", w: 12, right: true },
            { label: `Anterior (${period.compareLabel.replace("vs ", "")})`, w: 20, right: true },
            { label: "Variación", w: 12, right: true },
            { label: "Referencia", w: 28 },
          ]}
          rows={report.kpiRows.map((k) => [k.label, fmtKpi(k, k.value), fmtKpi(k, k.prev), fmtDiff(k), k.note || "-"])}
        />
        {!freshness.comparisonAvailable && <Text style={s.note}>Sin comparación: no hay datos del período anterior.</Text>}
        {freshness.partialFrom && <Text style={s.note}>Cobertura parcial: el período se calcula desde {monthLabel(freshness.partialFrom)}.</Text>}

        <Text style={s.h2}>Evolución (últimos 12 meses)</Text>
        <Table
          cols={[
            { label: "Mes", w: 25 },
            { label: "Rotación", w: 25, right: true },
            { label: "Ingresos", w: 25, right: true },
            { label: "Egresos", w: 25, right: true },
          ]}
          rows={overview.series.map((p) => [monthShort(p.month), p.rate === null ? "sin datos" : fmtPct(p.rate), fmtInt(p.altas), fmtInt(p.bajas)])}
        />
        <Text style={s.note}>Meta mensual: {fmtPct(kpis.rate.annualTarget / 12)} ({fmtPct(kpis.rate.annualTarget)} anual).</Text>
        {NOTES.map((n) => (
          <Text key={n} style={s.note}>
            • {n}
          </Text>
        ))}
        <Footer report={report} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Distribuciones</Text>
        <Text style={[s.muted, { marginBottom: 4 }]}>{period.label}</Text>
        {(
          [
            ["Bajas por categoría", overview.byCategory],
            ["Bajas por motivo", overview.byReason],
          ] as [string, ReasonItem[]][]
        ).map(([title, items]) => (
          <View key={title} wrap={false}>
            <Text style={s.h2}>{title}</Text>
            {items.length === 0 ? (
              <Text style={s.muted}>Sin bajas en el período.</Text>
            ) : (
              <Table
                cols={[
                  { label: "Valor", w: 52 },
                  { label: "Bajas", w: 24, right: true },
                  { label: "%", w: 24, right: true },
                ]}
                rows={reasonRows(items)}
              />
            )}
          </View>
        ))}
        {overview.dimensions.map((d) => (
          <View key={d.code} wrap={false}>
            <Text style={s.h2}>Rotación por {d.name.toLowerCase()}</Text>
            {d.items.length === 0 ? (
              <Text style={s.muted}>Sin datos.</Text>
            ) : (
              <Table
                cols={[
                  { label: "Unidad", w: 38 },
                  { label: "Rotación", w: 16, right: true },
                  { label: "Bajas", w: 12, right: true },
                  { label: "Headcount prom.", w: 18, right: true },
                  { label: "", w: 16 },
                ]}
                rows={d.items.map((i) => [
                  i.label,
                  i.rate === null ? "sin headcount" : fmtPct(i.rate),
                  fmtInt(i.bajas),
                  fmtDec(i.avgHeadcount),
                  i.small ? "muestra chica" : "",
                ])}
              />
            )}
          </View>
        ))}
        <Footer report={report} />
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.h2}>
          Bajas del período ({fmtInt(report.bajas.length)} {report.bajas.length === 1 ? "baja" : "bajas"})
        </Text>
        {report.bajas.length === 0 ? (
          <Text style={s.muted}>No hay bajas con los filtros aplicados.</Text>
        ) : (
          <Table
            cols={[
              { label: "Nombre", w: 18 },
              { label: "Legajo", w: 7 },
              ...dims.map((d) => ({ label: d.name, w: dimW })),
              { label: "Baja", w: 8 },
              { label: "Motivo", w: 15 },
              { label: "Categoría", w: 12 },
              { label: "Antigüedad", w: 8 },
            ]}
            rows={bajaRows(report.bajas, dims)}
            fixedHeader
          />
        )}
        <Footer report={report} />
      </Page>
    </Document>
  );
}
