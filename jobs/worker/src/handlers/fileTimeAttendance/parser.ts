import { parseRawRows, buildReverseMap, parseDate, parseDecimal } from "../shared/parseFile.js";
import type { TimeEntryRow, FileTimeAttendanceConfig, ParseResult, ParseError } from "./types.js";

const FIELDS = ["employee_code", "date", "time_entry_type", "hours"] as const;
type Field = (typeof FIELDS)[number];

const MAX_LEN = { employee_code: 50, time_entry_type: 50 } as const;

export async function parseFileTimeAttendance(
  buffer: Buffer,
  filename: string,
  cfg: FileTimeAttendanceConfig = {}
): Promise<ParseResult> {
  const rawRows = await parseRawRows(buffer, filename, cfg);

  // Faltan columnas: falla el job entero con la lista (no miles de errores por fila)
  if (rawRows.length > 0) {
    const present = new Set(Object.keys(rawRows[0]!).map((k) => k.toLowerCase().trim()));
    const missing = FIELDS.filter((f) => !present.has((cfg.columnMapping?.[f] ?? f).toLowerCase().trim()));
    if (missing.length > 0) {
      throw new Error(
        `Faltan columnas obligatorias: ${missing.join(", ")}. El archivo de Asistencia lleva una fila por persona, día y tipo de hora: ${FIELDS.join(", ")}.`
      );
    }
  }

  const reverseMap = buildReverseMap(FIELDS, cfg.columnMapping);
  const validRows: TimeEntryRow[] = [];
  const allErrors: ParseError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]!;
    const rowIndex = cfg.hasHeader === false ? i + 1 : i + 2;
    const text: Partial<Record<Field, string>> = {};
    const errors: ParseError[] = [];
    const err = (field: string, message: string, rawValue?: string) =>
      errors.push({ rowIndex, field, message, ...(rawValue !== undefined ? { rawValue } : {}) });

    for (const [rawKey, rawValue] of Object.entries(raw)) {
      const canonical = reverseMap.get(rawKey.toLowerCase().trim());
      if (canonical) text[canonical] = rawValue?.trim() ?? "";
    }

    for (const field of FIELDS) {
      if (!text[field]) err(field, `Campo requerido vacío: ${field}`);
    }
    for (const [field, max] of Object.entries(MAX_LEN)) {
      const v = text[field as keyof typeof MAX_LEN] ?? "";
      if (v.length > max) err(field, `${field} supera los ${max} caracteres`, v);
    }

    const date = parseDate(text.date ?? "");
    if (text.date && !date) err("date", `Fecha inválida: "${text.date}"`, text.date);

    let hours: string | null = null;
    const hoursRaw = text.hours ?? "";
    if (hoursRaw !== "") {
      const h = parseDecimal(hoursRaw);
      if (h === null || Number(h) < 0) err("hours", `Cantidad de horas inválida: "${hoursRaw}"`, hoursRaw);
      else if (Number(h) > 24) err("hours", "Las horas de un tipo son por día: no pueden superar 24", hoursRaw);
      else hours = h;
    }

    if (errors.length === 0) {
      validRows.push({
        source_row: rowIndex,
        employee_code: text.employee_code!,
        date: date!,
        time_entry_type: text.time_entry_type!,
        hours: hours!,
      });
    } else {
      allErrors.push(...errors);
    }
  }

  return { rows: validRows, errors: allErrors };
}
