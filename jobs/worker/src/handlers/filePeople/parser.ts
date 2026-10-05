import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { PersonRow, FilePeopleConfig, ParseResult, ParseError } from "./types.js";

// Columnas del modelo canónico — en orden de prioridad para validación
const CANONICAL_FIELDS = [
  "employee_code",
  "full_name",
  "hire_date",
  "status",
  "email",
  "birth_date",
  "gender",
  "document_type",
  "document_number",
  "contract_type",
  "manager_code",
  "area_code",
  "area_name",
  "position_code",
  "position_name",
] as const;

const REQUIRED_FIELDS: (keyof PersonRow)[] = ["employee_code", "full_name", "hire_date", "status"];

// Construye el mapa inverso: nombre_en_archivo → clave_canónica
function buildReverseMapping(
  columnMapping: FilePeopleConfig["columnMapping"] = {}
): Map<string, keyof PersonRow> {
  const map = new Map<string, keyof PersonRow>();
  for (const field of CANONICAL_FIELDS) {
    // Si hay un mapeo explícito, usar ese nombre; si no, el campo canónico mismo
    const sourceName = columnMapping[field] ?? field;
    map.set(sourceName.toLowerCase().trim(), field);
  }
  return map;
}

function parseDate(value: string, _format: string): string | null {
  if (!value || value.trim() === "") return null;
  const v = value.trim();

  // ISO ya válido
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // DD/MM/YYYY (común en LATAM)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }

  // Date object (ExcelJS puede devolver Date directo)
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

function mapRow(
  raw: Record<string, string>,
  reverseMap: Map<string, keyof PersonRow>,
  dateFormat: string,
  rowIndex: number
): { row: Partial<PersonRow>; errors: ParseError[] } {
  const row: Partial<PersonRow> = {};
  const errors: ParseError[] = [];

  // Mapear cada columna del archivo al modelo canónico
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const canonical = reverseMap.get(rawKey.toLowerCase().trim());
    if (!canonical) continue; // columna desconocida — ignorar

    const value = rawValue?.trim() ?? "";

    if (canonical === "hire_date" || canonical === "birth_date") {
      const parsed = parseDate(value, dateFormat);
      if (canonical === "hire_date" && !parsed && value !== "") {
        errors.push({ rowIndex, field: canonical, message: `Fecha inválida: "${value}"`, rawValue: value });
      }
      (row as Record<string, unknown>)[canonical] = parsed;
    } else {
      (row as Record<string, unknown>)[canonical] = value === "" ? null : value;
    }
  }

  return { row, errors };
}

function validateRow(
  row: Partial<PersonRow>,
  rowIndex: number
): ParseError[] {
  const errors: ParseError[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!row[field]) {
      errors.push({ rowIndex, field, message: `Campo requerido vacío: ${field}` });
    }
  }
  return errors;
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function parseCSV(
  buffer: Buffer,
  cfg: FilePeopleConfig
): Array<Record<string, string>> {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: cfg.hasHeader !== false,
    delimiter: cfg.csvDelimiter ?? ",",
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  return result.data;
}

// ─── XLSX / XLS ───────────────────────────────────────────────────────────────

async function parseXLSX(
  buffer: Buffer
): Promise<Array<Record<string, string>>> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS espera ArrayBuffer — convertir desde Node Buffer
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  const rows: Array<Record<string, string>> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(String(cell.value ?? "").trim());
      });
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

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function parseFilePeople(
  buffer: Buffer,
  filename: string,
  cfg: FilePeopleConfig = {}
): Promise<ParseResult> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const dateFormat = cfg.dateFormat ?? "DD/MM/YYYY";

  let rawRows: Array<Record<string, string>>;
  if (ext === "csv") {
    rawRows = parseCSV(buffer, cfg);
  } else if (ext === "xlsx" || ext === "xls") {
    rawRows = await parseXLSX(buffer);
  } else {
    throw new Error(`Formato de archivo no soportado: .${ext}. Usar CSV, XLS o XLSX.`);
  }

  const reverseMap = buildReverseMapping(cfg.columnMapping);
  const validRows: PersonRow[] = [];
  const allErrors: ParseError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const { row, errors: mapErrors } = mapRow(rawRows[i], reverseMap, dateFormat, i + 1);
    const valErrors = validateRow(row, i + 1);
    const rowErrors = [...mapErrors, ...valErrors];

    if (rowErrors.length === 0) {
      validRows.push(row as PersonRow);
    } else {
      allErrors.push(...rowErrors);
    }
  }

  return { rows: validRows, errors: allErrors };
}
