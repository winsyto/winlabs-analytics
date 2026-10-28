import ExcelJS from "exceljs";
import { monthLabel, monthShort } from "../../_dashboard-kit/format";
import { PROCESS_TYPE_LABELS } from "../_data/detail-queries";
import { MIN_PERSONS } from "../_data/types";
import { CONCEPT_NOTES, type ConceptReport } from "./concept-report";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };
const MONEY = "#,##0;[Red]-#,##0";
const PRIVATE = `reservado (menos de ${MIN_PERSONS} personas)`;
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

export async function buildConceptXlsx(report: ConceptReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WinLabs Analytics";
  wb.created = new Date();
  const { data } = report;
  const { period, currency, detail, overview } = data;

  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 38 }, { width: 22 }, { width: 24 }, { width: 18 }, { width: 40 }];
  rs.addRow([detail ? `Payroll — ${detail.concept.code} · ${detail.concept.name}` : "Payroll — detalle por concepto"]).font = { bold: true, size: 14 };
  rs.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", report.tenantName],
    ["Exportado", report.exportedAt],
    ["Última liquidación", monthLabel(data.freshness.refMonth, "long")],
    ...report.filterLines.map((l) => [l.label, l.value] as [string, string]),
  ];
  for (const [k, v] of meta) rs.addRow([k, v]).getCell(1).font = { bold: true };
  if (report.kpiRows.length) {
    rs.addRow([]);
    styleHeader(rs.addRow(["Indicador", "Valor", `Período anterior (${period.compareLabel.replace("vs ", "")})`, "Variación", "Referencia"]));
    for (const k of report.kpiRows) {
      const diff = k.value !== null && k.prev !== null ? round(k.value - k.prev) : null;
      const row = rs.addRow([k.label, k.value === null ? null : round(k.value), k.prev === null ? null : round(k.prev), diff, k.note]);
      if (k.kind === "money") [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = MONEY));
    }
  }
  rs.addRow([]);
  for (const n of [...CONCEPT_NOTES, ...(detail?.restricted ? [`Con estos filtros hay menos de ${MIN_PERSONS} personas por mes: los importes se reservan por privacidad.`] : [])]) {
    rs.addRow([n]).font = { italic: true, color: { argb: "FF6B7280" } };
  }

  if (overview) {
    const ws = wb.addWorksheet("Conceptos");
    ws.columns = [{ width: 16 }, { width: 34 }, { width: 28 }, { width: 12 }, { width: 22 }];
    styleHeader(ws.addRow(["Código", "Concepto", "Clase", "Personas", `Importe (${currency})`]));
    for (const r of overview) {
      const row = ws.addRow([r.code, r.name, r.className ?? "", r.persons, r.amount === null ? PRIVATE : round(r.amount)]);
      row.getCell(5).numFmt = MONEY;
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  if (detail) {
    const ev = wb.addWorksheet("Evolución", { views: [{ state: "frozen", ySplit: 1 }] });
    ev.columns = [
      { header: "Mes", key: "m", width: 12 },
      { header: `Importe (${currency})`, key: "a", width: 22, style: { numFmt: MONEY } },
      { header: "Personas", key: "p", width: 12 },
    ];
    styleHeader(ev.getRow(1));
    for (const s of detail.series) {
      ev.addRow({ m: monthShort(s.month), a: s.state === "ok" ? round(s.amount ?? 0) : s.state === "nodata" ? "sin datos" : PRIVATE, p: s.state === "ok" ? s.persons : "" });
    }

    const ps = wb.addWorksheet("Por proceso");
    ps.columns = [{ width: 10 }, { width: 24 }, { width: 18 }, { width: 12 }, { width: 22 }, { width: 14 }];
    styleHeader(ps.addRow(["Mes", "Proceso", "Tipo", "Personas", `Importe (${currency})`, "Cantidad"]));
    for (const r of detail.processes) {
      const row = ps.addRow([r.month.slice(0, 7), r.code, PROCESS_TYPE_LABELS[r.type] ?? r.type, r.persons, r.amount === null ? PRIVATE : round(r.amount), r.quantity === null ? "" : round(r.quantity)]);
      row.getCell(5).numFmt = MONEY;
    }

    const dm = wb.addWorksheet("Por dimensión");
    dm.columns = [{ width: 18 }, { width: 30 }, { width: 26 }, { width: 24 }, { width: 12 }];
    styleHeader(dm.addRow(["Dimensión", "Unidad", `Importe medio (${currency})`, `Importe total (${currency})`, "Personas"]));
    for (const d of detail.dimensions) {
      for (const i of d.items) {
        const row = dm.addRow([d.name, i.label, i.cost === null ? PRIVATE : round(i.cost), i.total === null ? PRIVATE : round(i.total), i.persons]);
        row.getCell(3).numFmt = MONEY;
        row.getCell(4).numFmt = MONEY;
      }
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
