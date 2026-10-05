import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface BaseConfig {
  csvDelimiter?: string;
  hasHeader?: boolean;
}

export function parseDate(value: string): string | null {
  if (!value || value.trim() === "") return null;
  const v = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }

  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

export function parseBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "si" || v === "sí" || v === "yes";
}

export function parseDecimal(value: string): string | null {
  if (!value || value.trim() === "") return null;
  const v = value.trim().replace(",", ".");
  return isNaN(Number(v)) ? null : v;
}

function parseCSV(buffer: Buffer, cfg: BaseConfig): Array<Record<string, string>> {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: cfg.hasHeader !== false,
    delimiter: cfg.csvDelimiter ?? ",",
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  return result.data;
}

async function parseXLSX(buffer: Buffer): Promise<Array<Record<string, string>>> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  const rows: Array<Record<string, string>> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => headers.push(String(cell.value ?? "").trim()));
      return;
    }
    const record: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1] ?? `col${colNumber}`;
      const val = cell.value;
      if (val instanceof Date) {
        record[header] = val.toISOString().slice(0, 10);
      } else {
        record[header] = val != null ? String(val) : "";
      }
    });
    rows.push(record);
  });

  return rows;
}

export async function parseRawRows(
  buffer: Buffer,
  filename: string,
  cfg: BaseConfig
): Promise<Array<Record<string, string>>> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv") return parseCSV(buffer, cfg);
  if (ext === "xlsx" || ext === "xls") return parseXLSX(buffer);
  throw new Error(`Formato no soportado: .${ext}. Usar CSV, XLS o XLSX.`);
}

export function buildReverseMap<T extends string>(
  fields: readonly T[],
  columnMapping: Partial<Record<T, string>> = {}
): Map<string, T> {
  const map = new Map<string, T>();
  for (const field of fields) {
    const sourceName = columnMapping[field] ?? field;
    map.set((sourceName as string).toLowerCase().trim(), field);
  }
  return map;
}
