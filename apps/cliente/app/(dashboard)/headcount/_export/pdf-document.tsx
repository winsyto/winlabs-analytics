import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtDate, fmtDec, fmtInt, fmtSigned, fmtTenure, monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { PersonRow } from "../_data/detail-queries";
import type { DistItem } from "../_data/types";
import { CONTRACT_LABELS, NOTES, type Report } from "./report";

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontSize: 8.5, fontFamily: "Helvetica", color: "#111214" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 5 },
  muted: { color: "#6b7280" },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaKey: { width: 90, fontFamily: "Helvetica-Bold" },
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
        {report.tenantName} · Headcount · exportado {report.exportedAt}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

const distRows = (items: DistItem[]) => {
  const total = items.reduce((a, i) => a + i.value, 0);
  return items.map((i) => [i.label, fmtInt(i.value), total ? `${fmtDec((i.value / total) * 100)}%` : "0,0%"]);
};

function peopleRows(rows: PersonRow[], withTermination: boolean) {
  return rows.map((r) => [
    r.name,
    r.code,
    r.area ?? "-",
    r.location ?? "-",
    r.position ?? "-",
    r.contract ? (CONTRACT_LABELS[r.contract] ?? r.contract) : "-",
    fmtDate(r.hireDate),
    ...(withTermination ? [fmtDate(r.terminationDate), r.reason ?? "-"] : []),
    fmtTenure(r.tenureMonths),
  ]);
}

function PeoplePages({ report, title, rows, withTermination }: { report: Report; title: string; rows: PersonRow[]; withTermination: boolean }) {
  const cols: Col[] = withTermination
    ? [
        { label: "Nombre", w: 15 }, { label: "Legajo", w: 8 }, { label: "Área", w: 11 }, { label: "Sede", w: 12 },
        { label: "Cargo", w: 12 }, { label: "Contrato", w: 8 }, { label: "Ingreso", w: 8 }, { label: "Baja", w: 8 },
        { label: "Motivo", w: 12 }, { label: "Antig.", w: 6, right: true },
      ]
    : [
        { label: "Nombre", w: 19 }, { label: "Legajo", w: 9 }, { label: "Área", w: 14 }, { label: "Sede", w: 15 },
        { label: "Cargo", w: 15 }, { label: "Contrato", w: 10 }, { label: "Ingreso", w: 10 }, { label: "Antig.", w: 8, right: true },
      ];
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Text style={s.h2}>
        {title} ({fmtInt(rows.length)} {rows.length === 1 ? "persona" : "personas"})
      </Text>
      {rows.length === 0 ? (
        <Text style={s.muted}>No hay personas para este listado con los filtros aplicados.</Text>
      ) : (
        <Table cols={cols} rows={peopleRows(rows, withTermination)} fixedHeader />
      )}
      <Footer report={report} />
    </Page>
  );
}

export function HeadcountPdf({ report }: { report: Report }) {
  const { overview } = report;
  const { freshness, period } = overview;

  const kpiTable = report.kpiRows.map((k) => {
    const diff = k.value !== null && k.prev !== null ? k.value - k.prev : null;
    const fmt = (n: number | null) => (n === null ? "-" : k.signed ? fmtSigned(n) : fmtInt(n));
    return [k.label, fmt(k.value), fmt(k.prev), diff === null ? "-" : fmtSigned(diff), k.avg === null ? "-" : `${k.avgLabel}: ${fmtDec(k.avg)}`];
  });

  return (
    <Document title={`Headcount - ${report.tenantName}`} author="WinLabs Analytics">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Headcount</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>{report.tenantName}</Text>

        {[
          ["Exportado", report.exportedAt],
          ["Datos al cierre de", monthLabel(freshness.refMonth, "long")],
          ["Historial desde", monthLabel(freshness.firstMonth)],
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
            { label: "Indicador", w: 34 },
            { label: "Valor", w: 12, right: true },
            { label: `Anterior (${period.compareLabel.replace("vs ", "")})`, w: 22, right: true },
            { label: "Variación", w: 12, right: true },
            { label: "Referencia", w: 20 },
          ]}
          rows={kpiTable}
        />
        {!freshness.comparisonAvailable && (
          <Text style={s.note}>Sin comparación: el historial no cubre el período anterior.</Text>
        )}

        <Text style={s.h2}>Evolución del headcount (últimos 12 cierres)</Text>
        <Table
          cols={[
            { label: "Mes", w: 40 },
            { label: "Headcount", w: 20, right: true },
            { label: "Altas", w: 20, right: true },
            { label: "Bajas", w: 20, right: true },
          ]}
          rows={overview.series.map((p) => [monthShort(p.month), p.headcount === null ? "sin dato" : fmtInt(p.headcount), fmtInt(p.altas), fmtInt(p.bajas)])}
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
        <Text style={[s.muted, { marginBottom: 4 }]}>Cierre de {monthLabel(period.refMonth, "long")}</Text>
        {(
          [
            ["Por área", overview.byArea],
            ["Por sede", overview.byLocation],
            ["Por tipo de contrato", overview.byContract],
          ] as const
        ).map(([title, items]) => (
          <View key={title} wrap={false}>
            <Text style={s.h2}>{title}</Text>
            <Table
              cols={[{ label: "Valor", w: 60 }, { label: "Personas", w: 20, right: true }, { label: "%", w: 20, right: true }]}
              rows={distRows([...items])}
            />
          </View>
        ))}
        <Footer report={report} />
      </Page>

      <PeoplePages report={report} title="Headcount al cierre" rows={report.activos} withTermination={false} />
      <PeoplePages report={report} title="Altas del período" rows={report.altas} withTermination={false} />
      <PeoplePages report={report} title="Bajas del período" rows={report.bajas} withTermination />
    </Document>
  );
}
