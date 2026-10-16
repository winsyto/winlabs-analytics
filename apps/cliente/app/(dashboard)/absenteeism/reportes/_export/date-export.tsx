import ExcelJS from "exceljs";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtDate } from "../../../_dashboard-kit/format";
import type { DateReportRow } from "../_data/by-date";
import type { DateReportData } from "../_data/by-date";
import { fmtPct } from "../../_components/format";

type Ok = Extract<DateReportData, { status: "ok" }>;

export interface DateReportExport {
  tenantName: string;
  tenantSlug: string;
  exportedAt: string;
  data: Ok;
  filterLines: { label: string; value: string }[];
}

const COLUMNS: { label: string; get: (r: DateReportRow) => number; group: "pres" | "aus" | "base" }[] = [
  { label: "Dotación asignada", get: (r) => r.assigned, group: "base" },
  { label: "Presentes (estimado)", get: (r) => r.present, group: "pres" },
  { label: "Franco", get: (r) => r.dayOff, group: "pres" },
  { label: "Vacaciones", get: (r) => r.vacation, group: "pres" },
  { label: "Lic. de ley", get: (r) => r.legalLeave, group: "pres" },
  { label: "Sin aviso", get: (r) => r.unjustified, group: "aus" },
  { label: "Sin goce", get: (r) => r.unpaid, group: "aus" },
  { label: "Enfermedad", get: (r) => r.medical, group: "aus" },
  { label: "Accidente", get: (r) => r.accident, group: "aus" },
  { label: "Suspensión", get: (r) => r.suspension, group: "aus" },
  { label: "Otras", get: (r) => r.other, group: "aus" },
  { label: "Total ausentes", get: (r) => r.absent, group: "aus" },
];

const NOTES = [
  "La dotación asignada son las personas con día laborable según su turno (o el horario de la empresa).",
  "Los presentes son una estimación: dotación menos francos, vacaciones, licencias y ausentes. Los presentes reales requieren asistencia detallada.",
  "% de ausentismo = ausentes ÷ dotación asignada. En un período las cifras son personas-día y las ausencias parciales cuentan como fracción de día.",
];

const round = (n: number) => Math.round(n * 100) / 100;
const fmtNum = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);

export async function buildDateXlsx(rep: DateReportExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WinLabs Analytics";
  wb.created = new Date();
  const { data } = rep;
  const ws = wb.addWorksheet("Resumen por fecha");
  ws.addRow(["Ausentismos — resumen por fecha y unidad"]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", rep.tenantName],
    ["Exportado", rep.exportedAt],
    ["Fecha", data.singleDay ? fmtDate(data.params.from) : `${fmtDate(data.params.from)} al ${fmtDate(data.params.to)}`],
    ["Cifras en", data.singleDay ? "personas" : "personas-día"],
    ...rep.filterLines.map((l) => [l.label, l.value] as [string, string]),
  ];
  for (const [k, v] of meta) ws.addRow([k, v]).getCell(1).font = { bold: true };
  ws.addRow([]);
  const header = ws.addRow([data.groupName ?? "Total", ...COLUMNS.map((c) => c.label), "% Ausentismo"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };
  const rows = data.groupName ? [...data.rows, data.total] : data.rows;
  for (const r of rows) {
    const row = ws.addRow([r.label, ...COLUMNS.map((c) => round(c.get(r))), r.pct === null ? "" : round(r.pct)]);
    if (r === data.total) row.font = { bold: true };
    row.getCell(COLUMNS.length + 2).numFmt = "0.00";
  }
  ws.getColumn(1).width = 30;
  for (let c = 2; c <= COLUMNS.length + 2; c++) ws.getColumn(c).width = 14;
  ws.addRow([]);
  for (const n of NOTES) ws.addRow([n]).font = { italic: true, color: { argb: "FF6B7280" } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const s = StyleSheet.create({
  page: { padding: 28, paddingBottom: 44, fontSize: 8, fontFamily: "Helvetica", color: "#111214" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  metaRow: { flexDirection: "row", marginBottom: 1.5 },
  metaKey: { width: 110, fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", backgroundColor: "#1e2530", color: "#ffffff", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e5e0" },
  trTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1e2530", fontFamily: "Helvetica-Bold" },
  cell: { paddingVertical: 3, paddingHorizontal: 3 },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", color: "#6b7280", fontSize: 7 },
  note: { color: "#6b7280", fontSize: 7, marginTop: 2 },
});

const W_FIRST = 17;
const W_PCT = 7;
const W_COL = (100 - W_FIRST - W_PCT) / COLUMNS.length;

function PdfRow({ r, style }: { r: DateReportRow; style: typeof s.tr | typeof s.trTotal }) {
  return (
    <View style={style} wrap={false}>
      <Text style={[s.cell, { width: `${W_FIRST}%` }]}>{r.label}</Text>
      {COLUMNS.map((c) => (
        <Text key={c.label} style={[s.cell, { width: `${W_COL}%`, textAlign: "right" }]}>
          {fmtNum(c.get(r))}
        </Text>
      ))}
      <Text style={[s.cell, { width: `${W_PCT}%`, textAlign: "right" }]}>{r.pct === null ? "-" : fmtPct(r.pct)}</Text>
    </View>
  );
}

export function DateReportPdf({ rep }: { rep: DateReportExport }) {
  const { data } = rep;
  return (
    <Document title={`Resumen por fecha - ${rep.tenantName}`} author="WinLabs Analytics">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.h1}>Ausentismos: resumen por fecha y unidad</Text>
        <Text style={[s.muted, { marginBottom: 6 }]}>{rep.tenantName}</Text>
        {[
          ["Exportado", rep.exportedAt],
          ["Fecha", data.singleDay ? fmtDate(data.params.from) : `${fmtDate(data.params.from)} al ${fmtDate(data.params.to)}`],
          ["Cifras en", data.singleDay ? "personas" : "personas-día"],
          ...rep.filterLines.map((l) => [l.label, l.value]),
        ].map(([k, v]) => (
          <View key={k} style={s.metaRow}>
            <Text style={s.metaKey}>{k}</Text>
            <Text>{v}</Text>
          </View>
        ))}
        <View style={{ marginTop: 8 }}>
          <View style={s.th} fixed>
            <Text style={[s.cell, { width: `${W_FIRST}%` }]}>{data.groupName ?? "Total"}</Text>
            {COLUMNS.map((c) => (
              <Text key={c.label} style={[s.cell, { width: `${W_COL}%`, textAlign: "right" }]}>
                {c.label}
              </Text>
            ))}
            <Text style={[s.cell, { width: `${W_PCT}%`, textAlign: "right" }]}>% Aus.</Text>
          </View>
          {data.rows.map((r) => (
            <PdfRow key={r.key} r={r} style={s.tr} />
          ))}
          {data.groupName && <PdfRow r={data.total} style={s.trTotal} />}
        </View>
        {NOTES.map((n) => (
          <Text key={n} style={s.note}>
            • {n}
          </Text>
        ))}
        <View style={s.footer} fixed>
          <Text>
            {rep.tenantName} · Resumen por fecha y unidad · exportado {rep.exportedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
