import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtDate, fmtInt, monthLabel, monthShort } from "../../_dashboard-kit/format";
import { PROCESS_TYPE_LABELS } from "../_data/detail-queries";
import { MIN_PERSONS, type ClassItem } from "../_data/types";
import { fmtMoney, fmtMoneyDiff, fmtShare } from "../_components/format";
import { NOTES, type Report } from "./report";

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

function Footer({ report }: { report: Report }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {report.tenantName} · Payroll · exportado {report.exportedAt}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

const classRows = (items: ClassItem[], currency: string) =>
  items.map((i) => [i.label, i.side === "earning" ? "Haber" : i.side === "deduction" ? "Retencion" : "Sin clasificar", fmtMoney(Math.abs(i.amount), currency), fmtShare(i.share)]);

export function PayrollPdf({ report }: { report: Report }) {
  const { overview } = report;
  const { freshness, period, currency, composition } = overview;
  const money = (n: number | null) => (n === null ? "-" : fmtMoney(n, currency));
  const comp = [...composition.earnings, ...(composition.unclassified ? [composition.unclassified] : []), ...composition.deductions];

  return (
    <Document title={`Payroll - ${report.tenantName}`} author="WinLabs Analytics">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Payroll</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>{report.tenantName}</Text>

        {[
          ["Exportado", report.exportedAt],
          ["Ultima liquidacion", monthLabel(freshness.refMonth, "long")],
          ["Liquidaciones desde", monthLabel(freshness.firstMonth)],
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
            { label: "Indicador", w: 26 },
            { label: "Valor", w: 17, right: true },
            { label: `Anterior (${period.compareLabel.replace("vs ", "")})`, w: 19, right: true },
            { label: "Variacion", w: 16, right: true },
            { label: "Referencia", w: 22 },
          ]}
          rows={report.kpiRows.map((k) => [
            k.label,
            money(k.value),
            money(k.prev),
            k.value !== null && k.prev !== null ? fmtMoneyDiff(k.value - k.prev, currency) : "-",
            k.note || "-",
          ])}
        />
        {overview.restricted && <Text style={s.note}>Con estos filtros hay menos de {MIN_PERSONS} personas por mes: los importes se reservan por privacidad.</Text>}
        {!freshness.comparisonAvailable && <Text style={s.note}>Sin comparacion: no hay liquidaciones del periodo anterior.</Text>}
        {freshness.partialFrom && <Text style={s.note}>Cobertura parcial: el periodo se calcula desde {monthLabel(freshness.partialFrom)}.</Text>}

        <Text style={s.h2}>Evolucion (ultimos 12 meses)</Text>
        <Table
          cols={[
            { label: "Mes", w: 22 },
            { label: "Masa bruta", w: 28, right: true },
            { label: "Neto", w: 28, right: true },
            { label: "Personas", w: 22, right: true },
          ]}
          rows={overview.series.map((p) => [
            monthShort(p.month),
            p.state === "ok" ? money(p.gross) : p.state === "nodata" ? "sin datos" : PRIVATE,
            p.state === "ok" ? (p.net === null ? "-" : money(p.net)) : "-",
            p.state === "ok" ? fmtInt(p.persons) : "-",
          ])}
        />
        {NOTES.map((n) => (
          <Text key={n} style={s.note}>
            • {n}
          </Text>
        ))}
        <Footer report={report} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Composicion y unidades</Text>
        <Text style={[s.muted, { marginBottom: 4 }]}>{period.label}</Text>
        <View wrap={false}>
          <Text style={s.h2}>Composicion por clase</Text>
          {comp.length === 0 ? (
            <Text style={s.muted}>Sin importes clasificados en el periodo.</Text>
          ) : (
            <Table
              cols={[
                { label: "Clase", w: 40 },
                { label: "Lado", w: 18 },
                { label: "Importe", w: 24, right: true },
                { label: "% de los haberes", w: 18, right: true },
              ]}
              rows={classRows(comp, currency)}
            />
          )}
        </View>
        {overview.dimensions.map((d) => (
          <View key={d.code} wrap={false}>
            <Text style={s.h2}>Costo medio por {d.name.toLowerCase()}</Text>
            {d.items.length === 0 ? (
              <Text style={s.muted}>Sin datos.</Text>
            ) : (
              <Table
                cols={[
                  { label: "Unidad", w: 34 },
                  { label: "Costo medio", w: 22, right: true },
                  { label: "Masa bruta", w: 26, right: true },
                  { label: "Personas", w: 18, right: true },
                ]}
                rows={d.items.map((i) => [i.label, i.cost === null ? PRIVATE : money(i.cost), i.total === null ? "-" : money(i.total), fmtInt(i.persons)])}
              />
            )}
          </View>
        ))}
        <Footer report={report} />
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.h2}>
          Procesos de liquidacion ({fmtInt(report.processes.length)} {report.processes.length === 1 ? "proceso" : "procesos"})
        </Text>
        {report.processes.length === 0 ? (
          <Text style={s.muted}>No hay procesos con los filtros aplicados.</Text>
        ) : (
          <Table
            cols={[
              { label: "Mes", w: 8 },
              { label: "Proceso", w: 22 },
              { label: "Tipo", w: 12 },
              { label: "Desde", w: 9 },
              { label: "Hasta", w: 9 },
              { label: "Personas", w: 8, right: true },
              { label: "Masa bruta", w: 16, right: true },
              { label: "Neto", w: 16, right: true },
            ]}
            rows={report.processes.map((r) => [
              r.month.slice(0, 7),
              r.code,
              PROCESS_TYPE_LABELS[r.type] ?? r.type,
              fmtDate(r.from),
              fmtDate(r.to),
              fmtInt(r.persons),
              r.gross === null ? PRIVATE : money(r.gross),
              r.net === null ? "-" : money(r.net),
            ])}
            fixedHeader
          />
        )}
        <Footer report={report} />
      </Page>
    </Document>
  );
}
