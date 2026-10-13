import ExcelJS from "exceljs";
import { monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { PersonRow } from "../_data/detail-queries";
import { CONTRACT_LABELS, NOTES, type Report } from "./report";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2530" } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

const toDate = (ymd: string | null) => (ymd ? new Date(`${ymd}T00:00:00Z`) : null);

function peopleSheet(wb: ExcelJS.Workbook, name: string, rows: PersonRow[], withTermination: boolean) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const cols = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Legajo", key: "code", width: 14 },
    { header: "Área", key: "area", width: 20 },
    { header: "Sede", key: "location", width: 22 },
    { header: "Cargo", key: "position", width: 22 },
    { header: "Contrato", key: "contract", width: 14 },
    { header: "Ingreso", key: "hire", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    ...(withTermination
      ? [
          { header: "Baja", key: "term", width: 12, style: { numFmt: "dd/mm/yyyy" } },
          { header: "Motivo", key: "reason", width: 24 },
        ]
      : []),
    { header: "Antigüedad (meses)", key: "tenure", width: 18 },
  ];
  ws.columns = cols;
  styleHeader(ws.getRow(1));
  for (const r of rows) {
    ws.addRow({
      name: r.name,
      code: r.code,
      area: r.area ?? "",
      location: r.location ?? "",
      position: r.position ?? "",
      contract: r.contract ? (CONTRACT_LABELS[r.contract] ?? r.contract) : "",
      hire: toDate(r.hireDate),
      term: toDate(r.terminationDate),
      reason: r.reason ?? "",
      tenure: r.tenureMonths,
    });
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

export async function buildXlsx(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WinLabs Analytics";
  wb.created = new Date();
  const { overview } = report;
  const { period, freshness } = overview;

  // Resumen
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 22 }];
  rs.addRow(["Headcount — resumen"]).font = { bold: true, size: 14 };
  rs.addRow([]);
  const meta: [string, string][] = [
    ["Empresa", report.tenantName],
    ["Exportado", report.exportedAt],
    ["Datos al cierre de", monthLabel(freshness.refMonth, "long")],
    ["Historial desde", monthLabel(freshness.firstMonth)],
    ...report.filterLines.map((l) => [l.label, l.value] as [string, string]),
  ];
  for (const [k, v] of meta) {
    const row = rs.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  }
  rs.addRow([]);
  const kh = rs.addRow(["Indicador", "Valor", `Período anterior (${period.compareLabel.replace("vs ", "")})`, "Variación", "Referencia"]);
  styleHeader(kh);
  for (const k of report.kpiRows) {
    const diff = k.value !== null && k.prev !== null ? k.value - k.prev : null;
    rs.addRow([k.label, k.value, k.prev, diff, k.avg === null ? "" : `${k.avgLabel}: ${k.avg.toFixed(1)}`]);
  }
  rs.addRow([]);
  for (const n of [...NOTES, ...(report.truncated ? ["Listados limitados a 20.000 filas."] : [])]) {
    rs.addRow([n]).font = { italic: true, color: { argb: "FF6B7280" } };
  }

  // Evolución
  const ev = wb.addWorksheet("Evolución", { views: [{ state: "frozen", ySplit: 1 }] });
  ev.columns = [
    { header: "Mes", key: "m", width: 12 },
    { header: "Headcount", key: "h", width: 12 },
    { header: "Altas", key: "a", width: 10 },
    { header: "Bajas", key: "b", width: 10 },
  ];
  styleHeader(ev.getRow(1));
  for (const s of overview.series) ev.addRow({ m: monthShort(s.month), h: s.headcount, a: s.altas, b: s.bajas });

  // Distribuciones
  const di = wb.addWorksheet("Distribuciones");
  di.columns = [{ width: 18 }, { width: 30 }, { width: 12 }, { width: 10 }];
  const dh = di.addRow(["Dimensión", "Valor", "Personas", "%"]);
  styleHeader(dh);
  const dist = (name: string, items: { label: string; value: number }[]) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    for (const i of items) {
      const row = di.addRow([name, i.label, i.value, total ? i.value / total : 0]);
      row.getCell(4).numFmt = "0.0%";
    }
  };
  dist("Área", overview.byArea);
  dist("Sede", overview.byLocation);
  dist("Contrato", overview.byContract);

  peopleSheet(wb, "Headcount al cierre", report.activos, false);
  peopleSheet(wb, "Altas", report.altas, false);
  peopleSheet(wb, "Bajas", report.bajas, true);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
