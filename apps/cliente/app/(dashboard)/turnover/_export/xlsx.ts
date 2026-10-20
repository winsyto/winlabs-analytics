import ExcelJS from "exceljs";
import { monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { NOTES, type Report } from "./report";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

const toDate = (ymd: string | null) => (ymd ? new Date(`${ymd}T00:00:00Z`) : null);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function dimCols(dims: Dimension[]) {
  return dims.map((d) => ({ header: d.name, key: `dim_${d.code}`, width: 22 }));
}

export async function buildXlsx(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WinLabs Analytics";
  wb.created = new Date();
  const { overview } = report;
  const { period, freshness, kpis } = overview;

  // Resumen
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 50 }];
  rs.addRow(["Rotación de personal — resumen"]).font = { bold: true, size: 14 };
  rs.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", report.tenantName],
    ["Exportado", report.exportedAt],
    ["Datos al cierre de", monthLabel(freshness.refMonth, "long")],
    ["Cierres desde", monthLabel(freshness.firstMonth)],
    ["Headcount promedio del período", overview.avgHeadcount === null ? "—" : String(round(overview.avgHeadcount))],
    ...report.filterLines.map((l) => [l.label, l.value] as [string, string]),
  ];
  for (const [k, v] of meta) rs.addRow([k, v]).getCell(1).font = { bold: true };
  rs.addRow([]);
  styleHeader(rs.addRow(["Indicador", "Valor", `Período anterior (${period.compareLabel.replace("vs ", "")})`, "Variación", "Referencia"]));
  for (const k of report.kpiRows) {
    const diff = k.value !== null && k.prev !== null ? round(k.value - k.prev) : null;
    const row = rs.addRow([k.label, k.value === null ? null : round(k.value), k.prev === null ? null : round(k.prev), diff, k.note]);
    if (k.kind === "pct") [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = "0.00"));
  }
  rs.addRow([]);
  const notes = [
    ...NOTES,
    ...(freshness.partialFrom ? [`Cobertura parcial: el período se calcula desde ${monthLabel(freshness.partialFrom)}.`] : []),
    ...(report.truncated ? ["Listado de bajas limitado a 20.000 filas."] : []),
  ];
  for (const n of notes) rs.addRow([n]).font = { italic: true, color: { argb: "FF6B7280" } };

  // Evolución
  const ev = wb.addWorksheet("Evolución", { views: [{ state: "frozen", ySplit: 1 }] });
  ev.columns = [
    { header: "Mes", key: "m", width: 12 },
    { header: "Rotación mensual (%)", key: "r", width: 22, style: { numFmt: "0.00" } },
    { header: "Meta mensual (%)", key: "t", width: 18, style: { numFmt: "0.00" } },
    { header: "Ingresos", key: "a", width: 12 },
    { header: "Egresos", key: "b", width: 12 },
  ];
  styleHeader(ev.getRow(1));
  for (const s of overview.series) {
    ev.addRow({ m: monthShort(s.month), r: s.rate === null ? "sin datos" : round(s.rate), t: round(kpis.rate.annualTarget / 12), a: s.altas, b: s.bajas });
  }

  // Por categoría y por motivo
  const mo = wb.addWorksheet("Bajas por motivo");
  mo.columns = [{ width: 14 }, { width: 36 }, { width: 10 }, { width: 16 }];
  styleHeader(mo.addRow(["Agrupación", "Valor", "Bajas", "% de las bajas"]));
  for (const [name, items] of [["Categoría", overview.byCategory], ["Motivo", overview.byReason]] as const) {
    for (const i of items) {
      const row = mo.addRow([name, i.label, i.count, i.share / 100]);
      row.getCell(4).numFmt = "0.0%";
    }
  }

  // Por dimensión
  const dm = wb.addWorksheet("Por dimensión");
  dm.columns = [{ width: 18 }, { width: 30 }, { width: 14 }, { width: 10 }, { width: 20 }, { width: 24 }];
  styleHeader(dm.addRow(["Dimensión", "Unidad", "Rotación (%)", "Bajas", "Headcount promedio", "Muestra chica"]));
  for (const d of overview.dimensions) {
    for (const i of d.items) {
      dm.addRow([d.name, i.label, i.rate === null ? "sin headcount" : round(i.rate), i.bajas, round(i.avgHeadcount), i.small ? "Sí (menos de 3 personas)" : ""]);
    }
  }

  // Bajas
  const bs = wb.addWorksheet("Bajas", { views: [{ state: "frozen", ySplit: 1 }] });
  const bcols = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Legajo", key: "code", width: 14 },
    ...dimCols(report.dimensions),
    { header: "Ingreso", key: "hire", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Baja", key: "term", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Motivo", key: "reason", width: 26 },
    { header: "Categoría", key: "cat", width: 18 },
    { header: "Antigüedad (meses)", key: "tenure", width: 18 },
  ];
  bs.columns = bcols;
  styleHeader(bs.getRow(1));
  for (const r of report.bajas) {
    bs.addRow({
      name: r.name,
      code: r.code,
      ...Object.fromEntries(report.dimensions.map((d) => [`dim_${d.code}`, r.units[d.code] ?? ""])),
      hire: toDate(r.hireDate),
      term: toDate(r.terminationDate),
      reason: r.reason,
      cat: r.category,
      tenure: r.tenureMonths,
    });
  }
  bs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: bcols.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
