import ExcelJS from "exceljs";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtPct } from "../../_components/format";
import { cellValue, per100, type Cell, type TypeReportData } from "../_data/by-type";

type Ok = Extract<TypeReportData, { status: "ok" }>;

export interface TypeReportExport {
  tenantName: string;
  tenantSlug: string;
  exportedAt: string;
  data: Ok;
  filterLines: { label: string; value: string }[];
}

const MEASURE = { events: "eventos", days: "días", hours: "horas" } as const;
const EMPTY: Cell = { events: 0, days: 0, hours: 0 };
const round = (n: number) => Math.round(n * 100) / 100;
const fmtNum = (n: number, events: boolean) =>
  events ? new Intl.NumberFormat("es-AR").format(n) : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);

const NOTES = [
  "Solo tipos de ausencia que cuentan como ausentismo.",
  "Índice = cantidad cada 100 personas. Índice del grupo: personas de la unidad; sobre la empresa: personas de toda la empresa. Incidencia = peso del tipo sobre el total de ausencias.",
  "Una persona que cambió de unidad en el período figura en ambas; un evento que cruza unidades se cuenta en cada una (el total no repite eventos).",
];

export async function buildTypeXlsx(rep: TypeReportExport): Promise<Buffer> {
  const { data } = rep;
  const m = data.params.measure;
  const wb = new ExcelJS.Workbook();
  wb.creator = "WinLabs Analytics";
  wb.created = new Date();
  const ws = wb.addWorksheet("Por tipo y unidad");
  ws.addRow(["Ausentismos — cuadro por tipo de ausencia y unidad"]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", rep.tenantName],
    ["Exportado", rep.exportedAt],
    ["Período", data.periodLabel],
    ["Cantidades en", MEASURE[m]],
    ...rep.filterLines.map((l) => [l.label, l.value] as [string, string]),
  ];
  for (const [k, v] of meta) ws.addRow([k, v]).getCell(1).font = { bold: true };
  ws.addRow([]);
  const header = ws.addRow(["Tipo de ausencia", "Clase", ...data.columns.map((c) => c.label), ...(data.groupName ? ["Total"] : []), "Incidencia (%)", "Índice (cada 100 personas)"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };
  const grand = cellValue(data.totals.all, m);
  for (const r of data.rows) {
    const inc = per100(cellValue(r.total, m), grand);
    const ind = per100(cellValue(r.total, m), data.people);
    ws.addRow([
      r.name,
      r.className,
      ...data.columns.map((c) => round(cellValue(r.cells[c.key] ?? EMPTY, m))),
      ...(data.groupName ? [round(cellValue(r.total, m))] : []),
      inc === null ? "" : round(inc),
      ind === null ? "" : round(ind),
    ]);
  }
  const bold = (row: ExcelJS.Row) => (row.font = { bold: true });
  bold(
    ws.addRow([
      "Total ausencias",
      "",
      ...data.columns.map((c) => round(cellValue(data.totals.byUnit[c.key] ?? EMPTY, m))),
      ...(data.groupName ? [round(grand)] : []),
      grand > 0 ? 100 : "",
      per100(grand, data.people) === null ? "" : round(per100(grand, data.people)!),
    ])
  );
  ws.addRow(["Dotación (personas)", "", ...data.columns.map((c) => c.people), ...(data.groupName ? [data.people] : [])]);
  if (data.groupName) {
    ws.addRow(["Índice del grupo (cada 100 personas)", "", ...data.columns.map((c) => {
      const v = per100(cellValue(data.totals.byUnit[c.key] ?? EMPTY, m), c.people);
      return v === null ? "" : round(v);
    })]);
    ws.addRow(["Índice sobre la empresa (cada 100 personas)", "", ...data.columns.map((c) => {
      const v = per100(cellValue(data.totals.byUnit[c.key] ?? EMPTY, m), data.people);
      return v === null ? "" : round(v);
    })]);
  }
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 20;
  for (let c = 3; c <= data.columns.length + 6; c++) ws.getColumn(c).width = 14;
  ws.addRow([]);
  for (const n of NOTES) ws.addRow([n]).font = { italic: true, color: { argb: "FF6B7280" } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const s = StyleSheet.create({
  page: { padding: 28, paddingBottom: 44, fontSize: 7.5, fontFamily: "Helvetica", color: "#111214" },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  metaRow: { flexDirection: "row", marginBottom: 1.5 },
  metaKey: { width: 100, fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", backgroundColor: "#1e2530", color: "#ffffff", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e5e0" },
  trTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#1e2530", fontFamily: "Helvetica-Bold" },
  cell: { paddingVertical: 3, paddingHorizontal: 2.5 },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", color: "#6b7280", fontSize: 7 },
  note: { color: "#6b7280", fontSize: 7, marginTop: 2 },
});

/** En el PDF entran hasta este número de columnas de unidad; el Excel trae todas. */
const PDF_MAX_UNITS = 14;

export function TypeReportPdf({ rep }: { rep: TypeReportExport }) {
  const { data } = rep;
  const m = data.params.measure;
  const events = m === "events";
  const cols = data.columns.slice(0, PDF_MAX_UNITS);
  const cut = data.columns.length > PDF_MAX_UNITS;
  const grand = cellValue(data.totals.all, m);
  const wFirst = 16;
  const wClass = 9;
  const wIdx = 6;
  const wCol = (100 - wFirst - wClass - wIdx * 2 - (data.groupName ? wIdx : 0)) / Math.max(1, cols.length);
  const Row = ({ cells, style }: { cells: string[]; style: typeof s.tr | typeof s.trTotal }) => (
    <View style={style} wrap={false}>
      {cells.map((t, i) => (
        <Text
          key={i}
          style={[s.cell, { width: `${i === 0 ? wFirst : i === 1 ? wClass : i < 2 + cols.length ? wCol : wIdx}%`, textAlign: i < 2 ? "left" : "right" }]}
        >
          {t}
        </Text>
      ))}
    </View>
  );
  const pct = (v: number | null) => (v === null ? "-" : fmtPct(v));
  const idx = (v: number | null) => (v === null ? "-" : fmtNum(v, false));
  const cell = (c: Cell | undefined) => (c && cellValue(c, m) > 0 ? fmtNum(cellValue(c, m), events) : "-");

  return (
    <Document title={`Cuadro por tipo y unidad - ${rep.tenantName}`} author="WinLabs Analytics">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.h1}>Ausentismos: cuadro por tipo de ausencia y unidad</Text>
        <Text style={[s.muted, { marginBottom: 6 }]}>{rep.tenantName}</Text>
        {[
          ["Exportado", rep.exportedAt],
          ["Período", data.periodLabel],
          ["Cantidades en", MEASURE[m]],
          ...rep.filterLines.map((l) => [l.label, l.value]),
        ].map(([k, v]) => (
          <View key={k} style={s.metaRow}>
            <Text style={s.metaKey}>{k}</Text>
            <Text>{v}</Text>
          </View>
        ))}
        <View style={{ marginTop: 8 }}>
          <View style={s.th} fixed>
            {[
              "Tipo",
              "Clase",
              ...cols.map((c) => c.label),
              ...(data.groupName ? ["Total"] : []),
              "Incid.",
              "Índice",
            ].map((t, i) => (
              <Text
                key={i}
                style={[s.cell, { width: `${i === 0 ? wFirst : i === 1 ? wClass : i < 2 + cols.length ? wCol : wIdx}%`, textAlign: i < 2 ? "left" : "right" }]}
              >
                {t}
              </Text>
            ))}
          </View>
          {data.rows.map((r) => (
            <Row
              key={r.code}
              style={s.tr}
              cells={[
                r.name,
                r.className,
                ...cols.map((c) => cell(r.cells[c.key])),
                ...(data.groupName ? [cell(r.total)] : []),
                pct(per100(cellValue(r.total, m), grand)),
                idx(per100(cellValue(r.total, m), data.people)),
              ]}
            />
          ))}
          <Row
            style={s.trTotal}
            cells={[
              "Total ausencias",
              "",
              ...cols.map((c) => cell(data.totals.byUnit[c.key])),
              ...(data.groupName ? [cell(data.totals.all)] : []),
              grand > 0 ? "100,0 %" : "-",
              idx(per100(grand, data.people)),
            ]}
          />
          <Row
            style={s.tr}
            cells={["Dotación (personas)", "", ...cols.map((c) => String(c.people)), ...(data.groupName ? [String(data.people)] : []), "", ""]}
          />
          {data.groupName && (
            <>
              <Row
                style={s.tr}
                cells={["Índice del grupo", "", ...cols.map((c) => idx(per100(cellValue(data.totals.byUnit[c.key] ?? EMPTY, m), c.people))), "", "", ""]}
              />
              <Row
                style={s.tr}
                cells={["Índice sobre la empresa", "", ...cols.map((c) => idx(per100(cellValue(data.totals.byUnit[c.key] ?? EMPTY, m), data.people))), "", "", ""]}
              />
            </>
          )}
        </View>
        {cut && <Text style={s.note}>Se muestran las primeras {PDF_MAX_UNITS} unidades; el Excel incluye todas.</Text>}
        {NOTES.map((n) => (
          <Text key={n} style={s.note}>
            • {n}
          </Text>
        ))}
        <View style={s.footer} fixed>
          <Text>
            {rep.tenantName} · Cuadro por tipo y unidad · exportado {rep.exportedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
