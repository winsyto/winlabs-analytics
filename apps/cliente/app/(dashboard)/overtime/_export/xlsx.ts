import ExcelJS from "exceljs";
import { fmtDate, monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { NOTES, type Report } from "./report";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function dimCols(dims: Dimension[]) {
  return dims.map((d) => ({ header: d.name, key: `dim_${d.code}`, width: 22 }));
}

export async function buildXlsx(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WinLabs Analytics";
  wb.created = new Date();
  const { overview } = report;
  const { period, freshness } = overview;

  // Resumen
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 44 }];
  rs.addRow(["Horas extras — resumen"]).font = { bold: true, size: 14 };
  rs.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", report.tenantName],
    ["Exportado", report.exportedAt],
    ["Datos al cierre de", monthLabel(freshness.refMonth, "long")],
    ["Horas desde", monthLabel(freshness.firstMonth)],
    ["Última carga", freshness.lastLoad ? fmtDate(freshness.lastLoad) : "—"],
    ["Cobertura", `${overview.coverage.covered} de ${overview.coverage.total} personas con horas informadas en el período`],
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
    ...(overview.notices.unclassifiedTypes > 0
      ? [`Hay ${overview.notices.unclassifiedTypes} tipo(s) de hora sin clasificar: no cuentan como horas extra hasta que se clasifiquen.`]
      : []),
    ...(freshness.partialFrom ? [`Cobertura parcial: el período se calcula desde ${monthLabel(freshness.partialFrom)}.`] : []),
    ...(report.truncated ? ["Listados limitados a 20.000 filas."] : []),
  ];
  for (const n of notes) rs.addRow([n]).font = { italic: true, color: { argb: "FF6B7280" } };

  // Evolución
  const ev = wb.addWorksheet("Evolución", { views: [{ state: "frozen", ySplit: 1 }] });
  ev.columns = [
    { header: "Mes", key: "m", width: 12 },
    { header: "Tasa (%)", key: "r", width: 12, style: { numFmt: "0.00" } },
    { header: "Meta (%)", key: "t", width: 12, style: { numFmt: "0.00" } },
    { header: "Horas extra", key: "h", width: 14 },
  ];
  styleHeader(ev.getRow(1));
  for (const s of overview.series) {
    ev.addRow({
      m: monthShort(s.month),
      r: s.rate === null ? "sin datos" : round(s.rate),
      t: overview.kpis.rate.target,
      h: s.hours === null ? "" : round(s.hours),
    });
  }

  // Por tipo
  const ty = wb.addWorksheet("Por tipo");
  ty.columns = [{ width: 36 }, { width: 14 }, { width: 22 }];
  styleHeader(ty.addRow(["Tipo de hora", "Horas", "% de las horas extra"]));
  for (const i of overview.byType) {
    const row = ty.addRow([i.label, round(i.hours), i.share / 100]);
    row.getCell(3).numFmt = "0.0%";
  }
  if (overview.unauthorized.hours > 0) {
    ty.addRow([]);
    ty.addRow(["Horas extra no autorizadas (fuera de la tasa)"]).font = { bold: true };
    for (const i of overview.unauthorized.items) {
      const row = ty.addRow([i.label, round(i.hours), i.share / 100]);
      row.getCell(3).numFmt = "0.0%";
    }
  }

  // Por dimensión
  const dm = wb.addWorksheet("Por dimensión");
  dm.columns = [{ width: 18 }, { width: 30 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 24 }];
  styleHeader(dm.addRow(["Dimensión", "Unidad", "Tasa (%)", "Horas extra", "Base (horas)", "Personas", "Muestra chica"]));
  for (const d of overview.dimensions) {
    for (const i of d.items) {
      dm.addRow([d.name, i.label, i.rate === null ? "sin horas informadas" : round(i.rate), round(i.hours), round(i.base), i.people, i.small ? "Sí (menos de 3 personas)" : ""]);
    }
  }

  // Horas por persona y tipo
  const hs = wb.addWorksheet("Horas por persona y tipo", { views: [{ state: "frozen", ySplit: 1 }] });
  const hcols = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Legajo", key: "code", width: 14 },
    ...dimCols(report.dimensions),
    { header: "Tipo de hora", key: "type", width: 30 },
    { header: "Horas extra", key: "hours", width: 12 },
  ];
  hs.columns = hcols;
  styleHeader(hs.getRow(1));
  for (const r of report.hours) {
    hs.addRow({
      name: r.name,
      code: r.code,
      ...Object.fromEntries(report.dimensions.map((d) => [`dim_${d.code}`, r.units[d.code] ?? ""])),
      type: r.typeName,
      hours: round(r.hours),
    });
  }
  hs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hcols.length } };

  // Personas
  const ps = wb.addWorksheet("Personas", { views: [{ state: "frozen", ySplit: 1 }] });
  const pcols = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Legajo", key: "code", width: 14 },
    ...dimCols(report.dimensions),
    { header: "Horas extra", key: "hours", width: 12 },
    { header: "Por tipo de hora", key: "types", width: 50 },
  ];
  ps.columns = pcols;
  styleHeader(ps.getRow(1));
  for (const r of report.people) {
    ps.addRow({
      name: r.name,
      code: r.code,
      ...Object.fromEntries(report.dimensions.map((d) => [`dim_${d.code}`, r.units[d.code] ?? ""])),
      hours: round(r.hours),
      types: r.byType.map((t) => `${t.name} ${round(t.hours)} h`).join(" · "),
    });
  }
  ps.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: pcols.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
