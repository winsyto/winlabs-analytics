import ExcelJS from "exceljs";
import { monthLabel, monthShort } from "../../_dashboard-kit/format";
import { PROCESS_TYPE_LABELS } from "../_data/detail-queries";
import { MIN_PERSONS } from "../_data/types";
import { NOTES, type Report } from "./report";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

const toDate = (ymd: string | null) => (ymd ? new Date(`${ymd}T00:00:00Z`) : null);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const PRIVATE = `reservado (menos de ${MIN_PERSONS} personas)`;

export async function buildXlsx(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WinLabs Analytics";
  wb.created = new Date();
  const { overview } = report;
  const { period, freshness, currency, composition } = overview;
  const MONEY = `#,##0;[Red]-#,##0`;

  // Resumen
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 36 }, { width: 20 }, { width: 22 }, { width: 18 }, { width: 50 }];
  rs.addRow(["Payroll — resumen"]).font = { bold: true, size: 14 };
  rs.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", report.tenantName],
    ["Exportado", report.exportedAt],
    ["Última liquidación", monthLabel(freshness.refMonth, "long")],
    ["Liquidaciones desde", monthLabel(freshness.firstMonth)],
    ...report.filterLines.map((l) => [l.label, l.value] as [string, string]),
  ];
  for (const [k, v] of meta) rs.addRow([k, v]).getCell(1).font = { bold: true };
  rs.addRow([]);
  styleHeader(rs.addRow(["Indicador", `Valor (${currency})`, `Período anterior (${period.compareLabel.replace("vs ", "")})`, "Variación", "Referencia"]));
  for (const k of report.kpiRows) {
    const diff = k.value !== null && k.prev !== null ? round(k.value - k.prev) : null;
    const row = rs.addRow([k.label, k.value === null ? null : round(k.value), k.prev === null ? null : round(k.prev), diff, k.note]);
    [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = MONEY));
  }
  rs.addRow([]);
  const notes = [
    ...NOTES,
    ...(overview.restricted ? [`Con estos filtros hay menos de ${MIN_PERSONS} personas por mes: los importes se reservan por privacidad.`] : []),
    ...(freshness.partialFrom ? [`Cobertura parcial: el período se calcula desde ${monthLabel(freshness.partialFrom)}.`] : []),
    ...(freshness.unclassifiedConcepts > 0 ? [`Hay ${freshness.unclassifiedConcepts} conceptos sin clasificar (ver Configuración > Conceptos de liquidación).`] : []),
  ];
  for (const n of notes) rs.addRow([n]).font = { italic: true, color: { argb: "FF6B7280" } };

  // Evolución
  const ev = wb.addWorksheet("Evolución", { views: [{ state: "frozen", ySplit: 1 }] });
  ev.columns = [
    { header: "Mes", key: "m", width: 12 },
    { header: `Masa bruta (${currency})`, key: "g", width: 22, style: { numFmt: MONEY } },
    { header: `Neto (${currency})`, key: "n", width: 20, style: { numFmt: MONEY } },
    { header: "Personas pagadas", key: "p", width: 18 },
  ];
  styleHeader(ev.getRow(1));
  for (const s of overview.series) {
    const text = s.state === "nodata" ? "sin datos" : PRIVATE;
    ev.addRow({
      m: monthShort(s.month),
      g: s.state === "ok" ? round(s.gross ?? 0) : text,
      n: s.state === "ok" ? (s.net === null ? "—" : round(s.net)) : text,
      p: s.state === "ok" ? s.persons : "",
    });
  }

  // Composición por clase
  const cp = wb.addWorksheet("Composición");
  cp.columns = [{ width: 30 }, { width: 14 }, { width: 22 }, { width: 18 }];
  styleHeader(cp.addRow(["Clase", "Lado", `Importe (${currency})`, "% de los haberes"]));
  const comp = [...composition.earnings, ...(composition.unclassified ? [composition.unclassified] : []), ...composition.deductions];
  for (const i of comp) {
    const row = cp.addRow([i.label, i.side === "earning" ? "Haber" : i.side === "deduction" ? "Retención" : "Sin clasificar", round(i.amount), i.share / 100]);
    row.getCell(3).numFmt = MONEY;
    row.getCell(4).numFmt = "0.0%";
  }

  // Por dimensión
  const dm = wb.addWorksheet("Por dimensión");
  dm.columns = [{ width: 18 }, { width: 30 }, { width: 24 }, { width: 22 }, { width: 12 }];
  styleHeader(dm.addRow(["Dimensión", "Unidad", `Costo medio (${currency})`, `Masa bruta (${currency})`, "Personas"]));
  for (const d of overview.dimensions) {
    for (const i of d.items) {
      const row = dm.addRow([d.name, i.label, i.cost === null ? PRIVATE : round(i.cost), i.total === null ? PRIVATE : round(i.total), i.persons]);
      row.getCell(3).numFmt = MONEY;
      row.getCell(4).numFmt = MONEY;
    }
  }

  // Procesos
  const ps = wb.addWorksheet("Procesos", { views: [{ state: "frozen", ySplit: 1 }] });
  ps.columns = [
    { header: "Mes", key: "m", width: 10 },
    { header: "Proceso", key: "c", width: 22 },
    { header: "Descripción", key: "d", width: 32 },
    { header: "Tipo", key: "t", width: 18 },
    { header: "Desde", key: "f", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Hasta", key: "h", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Personas", key: "p", width: 10 },
    { header: `Masa bruta (${currency})`, key: "g", width: 22, style: { numFmt: MONEY } },
    { header: `Neto (${currency})`, key: "n", width: 20, style: { numFmt: MONEY } },
  ];
  styleHeader(ps.getRow(1));
  for (const r of report.processes) {
    ps.addRow({
      m: r.month.slice(0, 7),
      c: r.code,
      d: r.description ?? "",
      t: PROCESS_TYPE_LABELS[r.type] ?? r.type,
      f: toDate(r.from),
      h: toDate(r.to),
      p: r.persons,
      g: r.gross === null ? PRIVATE : round(r.gross),
      n: r.net === null ? "—" : round(r.net),
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
