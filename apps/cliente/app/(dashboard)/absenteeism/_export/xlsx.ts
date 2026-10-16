import ExcelJS from "exceljs";
import { fmtDate, monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { NOTES, type Report } from "./report";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };
const STATUS: Record<string, string> = { open: "Abierto", closed: "Cerrado", cancelled: "Cancelado" };

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
  const { period, freshness } = overview;

  // Resumen
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 38 }];
  rs.addRow(["Ausentismos — resumen"]).font = { bold: true, size: 14 };
  rs.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", report.tenantName],
    ["Exportado", report.exportedAt],
    ["Datos al cierre de", monthLabel(freshness.refMonth, "long")],
    ["Eventos desde", monthLabel(freshness.firstMonth)],
    ["Última carga", freshness.lastLoad ? fmtDate(freshness.lastLoad) : "—"],
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
      ? [`Hay ${overview.notices.unclassifiedTypes} tipo(s) de ausencia sin clasificar: cuentan como ausentismo hasta que se clasifiquen.`]
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
    { header: "Horas de ausencia", key: "h", width: 18 },
    { header: "Días de ausencia", key: "d", width: 18 },
  ];
  styleHeader(ev.getRow(1));
  for (const s of overview.series) {
    ev.addRow({
      m: monthShort(s.month),
      r: s.rate === null ? "sin datos" : round(s.rate),
      t: overview.kpis.rate.target,
      h: s.hours === null ? "" : round(s.hours),
      d: s.days === null ? "" : round(s.days),
    });
  }

  // Clase y tipo
  const ct = wb.addWorksheet("Clase y tipo");
  ct.columns = [{ width: 12 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 10 }];
  styleHeader(ct.addRow(["Agrupación", "Valor", "Días", "Horas", "Eventos", "% de la ausencia"]));
  const addBreakdown = (name: string, items: typeof overview.byClass) => {
    for (const i of items) {
      const row = ct.addRow([name, i.label, round(i.days), round(i.hours), i.events, i.share / 100]);
      row.getCell(6).numFmt = "0.0%";
    }
  };
  addBreakdown("Clase", overview.byClass);
  addBreakdown("Tipo", overview.byType);
  addBreakdown("Fuera de la tasa", overview.excluded.items);

  // Por dimensión
  const dm = wb.addWorksheet("Por dimensión");
  dm.columns = [{ width: 18 }, { width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }];
  styleHeader(dm.addRow(["Dimensión", "Unidad", "Tasa (%)", "Horas", "Días", "Personas", "Muestra chica"]));
  for (const d of overview.dimensions) {
    for (const i of d.items) {
      dm.addRow([d.name, i.label, i.rate === null ? "sin horas programadas" : round(i.rate), round(i.hours), round(i.days), i.people, i.small ? "Sí (menos de 3 personas)" : ""]);
    }
  }

  // Eventos
  const es = wb.addWorksheet("Eventos", { views: [{ state: "frozen", ySplit: 1 }] });
  const ecols = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Legajo", key: "code", width: 14 },
    ...dimCols(report.dimensions),
    { header: "Tipo", key: "type", width: 26 },
    { header: "Clase", key: "cls", width: 18 },
    { header: "Desde", key: "start", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Hasta", key: "end", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Días", key: "days", width: 10 },
    { header: "Horas", key: "hours", width: 10 },
    { header: "Estado", key: "status", width: 12 },
  ];
  es.columns = ecols;
  styleHeader(es.getRow(1));
  for (const r of report.events) {
    es.addRow({
      name: r.name,
      code: r.code,
      ...Object.fromEntries(report.dimensions.map((d) => [`dim_${d.code}`, r.units[d.code] ?? ""])),
      type: r.typeName,
      cls: r.className,
      start: toDate(r.start),
      end: toDate(r.end),
      days: round(r.days),
      hours: round(r.hours),
      status: STATUS[r.status] ?? r.status,
    });
  }
  es.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ecols.length } };

  // Personas
  const ps = wb.addWorksheet("Personas", { views: [{ state: "frozen", ySplit: 1 }] });
  const pcols = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Legajo", key: "code", width: 14 },
    ...dimCols(report.dimensions),
    { header: "Eventos", key: "events", width: 10 },
    { header: "Días", key: "days", width: 10 },
    { header: "Horas", key: "hours", width: 10 },
  ];
  ps.columns = pcols;
  styleHeader(ps.getRow(1));
  for (const r of report.people) {
    ps.addRow({
      name: r.name,
      code: r.code,
      ...Object.fromEntries(report.dimensions.map((d) => [`dim_${d.code}`, r.units[d.code] ?? ""])),
      events: r.events,
      days: round(r.days),
      hours: round(r.hours),
    });
  }
  ps.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: pcols.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
