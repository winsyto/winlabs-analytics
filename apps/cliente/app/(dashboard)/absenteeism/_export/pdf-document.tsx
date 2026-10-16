import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtDate, fmtDec, fmtInt, monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import type { EventRow, PersonRow } from "../_data/detail-queries";
import type { BreakdownItem } from "../_data/types";
import { fmtDays, fmtHours, fmtPct, fmtPp } from "../_components/format";
import { NOTES, type KpiRow, type Report } from "./report";

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontSize: 8.5, fontFamily: "Helvetica", color: "#111214" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 5 },
  muted: { color: "#6b7280" },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaKey: { width: 110, fontFamily: "Helvetica-Bold" },
  metaVal: { flex: 1 },
  th: { flexDirection: "row", backgroundColor: "#1e2530", color: "#ffffff", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e5e0" },
  cell: { paddingVertical: 3, paddingHorizontal: 4 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", color: "#6b7280", fontSize: 7.5 },
  note: { color: "#6b7280", fontSize: 7.5, marginTop: 2 },
});

const ascii = (t: string) => t.replace(/−/g, "-");
const STATUS: Record<string, string> = { open: "Abierto", closed: "Cerrado", cancelled: "Cancelado" };

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
        {report.tenantName} · Ausentismos · exportado {report.exportedAt}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

const fmtKpi = (k: KpiRow, n: number | null) =>
  n === null ? "-" : k.kind === "pct" ? fmtPct(n) : k.kind === "days" ? fmtDays(n) : k.kind === "hours" ? fmtHours(n) : fmtInt(n);
const fmtDiff = (k: KpiRow) => {
  if (k.value === null || k.prev === null) return "-";
  const d = k.value - k.prev;
  if (k.kind === "pct") return fmtPp(d);
  const sign = d > 0 ? "+" : d < 0 ? "-" : "";
  return `${sign}${fmtKpi(k, Math.abs(d))}`;
};

const breakdownRows = (items: BreakdownItem[]) =>
  items.map((i) => [i.label, fmtDays(i.days), fmtHours(i.hours), fmtInt(i.events), `${fmtDec(i.share)}%`]);

function eventRows(rows: EventRow[], dims: Dimension[]) {
  return rows.map((r) => [
    r.name,
    r.code,
    ...dims.map((d) => r.units[d.code] ?? "-"),
    r.typeName,
    r.className,
    fmtDate(r.start),
    fmtDate(r.end),
    fmtDec(r.days),
    fmtDec(r.hours),
    STATUS[r.status] ?? r.status,
  ]);
}

function personRows(rows: PersonRow[], dims: Dimension[]) {
  return rows.map((r) => [r.name, r.code, ...dims.map((d) => r.units[d.code] ?? "-"), fmtInt(r.events), fmtDec(r.days), fmtDec(r.hours)]);
}

function ListPage({ report, title, children, count, noun }: { report: Report; title: string; children: React.ReactNode; count: number; noun: string }) {
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Text style={s.h2}>
        {title} ({fmtInt(count)} {noun})
      </Text>
      {count === 0 ? <Text style={s.muted}>No hay datos para este listado con los filtros aplicados.</Text> : children}
      <Footer report={report} />
    </Page>
  );
}

export function AbsenteeismPdf({ report }: { report: Report }) {
  const { overview } = report;
  const { freshness, period } = overview;
  const dims = report.dimensions;
  const dimW = dims.length ? 22 / dims.length : 0;

  return (
    <Document title={`Ausentismos - ${report.tenantName}`} author="WinLabs Analytics">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Ausentismos</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>{report.tenantName}</Text>

        {[
          ["Exportado", report.exportedAt],
          ["Datos al cierre de", monthLabel(freshness.refMonth, "long")],
          ["Eventos desde", monthLabel(freshness.firstMonth)],
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
            { label: "Valor", w: 14, right: true },
            { label: `Anterior (${period.compareLabel.replace("vs ", "")})`, w: 22, right: true },
            { label: "Variación", w: 12, right: true },
            { label: "Referencia", w: 24 },
          ]}
          rows={report.kpiRows.map((k) => [k.label, fmtKpi(k, k.value), fmtKpi(k, k.prev), fmtDiff(k), k.note || "-"])}
        />
        {!freshness.comparisonAvailable && <Text style={s.note}>Sin comparación: no hay datos del período anterior.</Text>}
        {overview.notices.unclassifiedTypes > 0 && (
          <Text style={s.note}>
            Hay {overview.notices.unclassifiedTypes} tipo(s) de ausencia sin clasificar: cuentan como ausentismo hasta que se clasifiquen.
          </Text>
        )}
        {freshness.partialFrom && <Text style={s.note}>Cobertura parcial: el período se calcula desde {monthLabel(freshness.partialFrom)}.</Text>}

        <Text style={s.h2}>Evolución de la tasa (últimos 12 meses)</Text>
        <Table
          cols={[
            { label: "Mes", w: 25 },
            { label: "Tasa", w: 25, right: true },
            { label: "Días", w: 25, right: true },
            { label: "Horas", w: 25, right: true },
          ]}
          rows={overview.series.map((p) => [
            monthShort(p.month),
            p.rate === null ? "sin datos" : fmtPct(p.rate),
            p.days === null ? "-" : fmtDays(p.days),
            p.hours === null ? "-" : fmtHours(p.hours),
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
        <Text style={s.h1}>Distribuciones</Text>
        <Text style={[s.muted, { marginBottom: 4 }]}>{period.label}</Text>
        {(
          [
            ["Ausencia por clase", overview.byClass],
            ["Ausencia por tipo", overview.byType],
            ["Fuera de la tasa (vacaciones, licencias y francos)", overview.excluded.items],
          ] as [string, BreakdownItem[]][]
        ).map(([title, items]) => (
          <View key={title} wrap={false}>
            <Text style={s.h2}>{title}</Text>
            {items.length === 0 ? (
              <Text style={s.muted}>Sin ausencias en el período.</Text>
            ) : (
              <Table
                cols={[
                  { label: "Valor", w: 36 },
                  { label: "Días", w: 16, right: true },
                  { label: "Horas", w: 16, right: true },
                  { label: "Eventos", w: 16, right: true },
                  { label: "%", w: 16, right: true },
                ]}
                rows={breakdownRows(items)}
              />
            )}
          </View>
        ))}
        {overview.dimensions.map((d) => (
          <View key={d.code} wrap={false}>
            <Text style={s.h2}>Tasa por {d.name.toLowerCase()}</Text>
            {d.items.length === 0 ? (
              <Text style={s.muted}>Sin datos.</Text>
            ) : (
              <Table
                cols={[
                  { label: "Unidad", w: 34 },
                  { label: "Tasa", w: 14, right: true },
                  { label: "Días", w: 14, right: true },
                  { label: "Horas", w: 14, right: true },
                  { label: "Personas", w: 12, right: true },
                  { label: "", w: 12 },
                ]}
                rows={d.items.map((i) => [
                  i.label,
                  i.rate === null ? "sin horas" : fmtPct(i.rate),
                  fmtDays(i.days),
                  fmtHours(i.hours),
                  fmtInt(i.people),
                  i.small ? "muestra chica" : "",
                ])}
              />
            )}
          </View>
        ))}
        <Footer report={report} />
      </Page>

      <ListPage report={report} title="Eventos de ausencia" count={report.events.length} noun={report.events.length === 1 ? "evento" : "eventos"}>
        <Table
          cols={[
            { label: "Nombre", w: 14 },
            { label: "Legajo", w: 6 },
            ...dims.map((d) => ({ label: d.name, w: dimW })),
            { label: "Tipo", w: 11 },
            { label: "Clase", w: 9 },
            { label: "Desde", w: 7 },
            { label: "Hasta", w: 7 },
            { label: "Días", w: 5, right: true },
            { label: "Horas", w: 5, right: true },
            { label: "Estado", w: 6 },
          ]}
          rows={eventRows(report.events, dims)}
          fixedHeader
        />
      </ListPage>

      <ListPage report={report} title="Personas con ausencias" count={report.people.length} noun={report.people.length === 1 ? "persona" : "personas"}>
        <Table
          cols={[
            { label: "Nombre", w: 22 },
            { label: "Legajo", w: 9 },
            ...dims.map((d) => ({ label: d.name, w: dims.length ? 49 / dims.length : 0 })),
            { label: "Eventos", w: 8, right: true },
            { label: "Días", w: 6, right: true },
            { label: "Horas", w: 6, right: true },
          ]}
          rows={personRows(report.people, dims)}
          fixedHeader
        />
      </ListPage>
    </Document>
  );
}
