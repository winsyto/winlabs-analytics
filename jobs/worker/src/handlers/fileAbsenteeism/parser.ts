import { parseRawRows, buildReverseMap, parseDate, parseDecimal } from "../shared/parseFile.js";
import {
  ABSENTEEISM_CLASSES,
  ABSENTEEISM_STATUSES,
  type AbsenteeismRow,
  type FileAbsenteeismConfig,
  type ParseResult,
  type ParseError,
} from "./types.js";

const FIELDS = [
  "employee_code", "absenteeism_type_code", "start_date", "end_date",
  "days_count", "hours_count", "justified", "status", "notes",
  "absenteeism_type_name", "absenteeism_class", "counts_as_absence",
] as const;

const REQUIRED = ["employee_code", "absenteeism_type_code", "start_date", "end_date"] as const;

const MAX_LEN = { employee_code: 50, absenteeism_type_code: 50, absenteeism_type_name: 100 } as const;
const MAX_DAYS = 999;

const TRUE_VALUES = new Set(["1", "true", "si", "sí", "yes", "s"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n"]);

export async function parseFileAbsenteeism(
  buffer: Buffer,
  filename: string,
  cfg: FileAbsenteeismConfig = {}
): Promise<ParseResult> {
  const rawRows = await parseRawRows(buffer, filename, cfg);
  const reverseMap = buildReverseMap(FIELDS, cfg.columnMapping);
  const validRows: AbsenteeismRow[] = [];
  const allErrors: ParseError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowIndex = cfg.hasHeader === false ? i + 1 : i + 2;
    const text: Partial<Record<(typeof FIELDS)[number], string>> = {};
    const errors: ParseError[] = [];
    const err = (field: string, message: string, rawValue?: string) =>
      errors.push({ rowIndex, field, message, ...(rawValue !== undefined ? { rawValue } : {}) });

    for (const [rawKey, rawValue] of Object.entries(raw)) {
      const canonical = reverseMap.get(rawKey.toLowerCase().trim());
      if (canonical) text[canonical as (typeof FIELDS)[number]] = rawValue?.trim() ?? "";
    }

    for (const field of REQUIRED) {
      if (!text[field]) err(field, `Campo requerido vacío: ${field}`);
    }
    for (const [field, max] of Object.entries(MAX_LEN)) {
      const v = text[field as keyof typeof MAX_LEN] ?? "";
      if (v.length > max) err(field, `${field} supera los ${max} caracteres`, v);
    }

    // Fechas
    const start = parseDate(text.start_date ?? "");
    const end = parseDate(text.end_date ?? "");
    if (text.start_date && !start) err("start_date", `Fecha inválida: "${text.start_date}"`, text.start_date);
    if (text.end_date && !end) err("end_date", `Fecha inválida: "${text.end_date}"`, text.end_date);
    if (start && end && end < start) {
      err("end_date", `La fecha de fin (${end}) es anterior a la de inicio (${start})`, text.end_date);
    }

    // Días y horas por día (opcionales; vacío o 0 = no informado)
    let days: string | null = null;
    const daysRaw = text.days_count ?? "";
    if (daysRaw !== "") {
      const d = parseDecimal(daysRaw);
      if (d === null || Number(d) < 0) err("days_count", `Cantidad de días inválida: "${daysRaw}"`, daysRaw);
      else if (Number(d) > MAX_DAYS) err("days_count", `Cantidad de días fuera de rango (máximo ${MAX_DAYS})`, daysRaw);
      else days = Number(d) === 0 ? null : d;
    }
    let hours: string | null = null;
    const hoursRaw = text.hours_count ?? "";
    if (hoursRaw !== "") {
      const h = parseDecimal(hoursRaw);
      if (h === null || Number(h) < 0) err("hours_count", `Cantidad de horas inválida: "${hoursRaw}"`, hoursRaw);
      else if (Number(h) > 24) err("hours_count", "Las horas de ausencia son por día: no pueden superar 24", hoursRaw);
      else hours = Number(h) === 0 ? null : h;
    }

    // Estado
    const status = (text.status ?? "").toLowerCase() || "open";
    if (!(ABSENTEEISM_STATUSES as readonly string[]).includes(status)) {
      err("status", `Estado inválido: "${text.status}". Valores: ${ABSENTEEISM_STATUSES.join(" | ")}`, text.status);
    }

    // Clasificación del tipo (solo se usa al crear el tipo)
    const cls = (text.absenteeism_class ?? "").toLowerCase();
    if (cls && !(ABSENTEEISM_CLASSES as readonly string[]).includes(cls)) {
      err("absenteeism_class", `Clase inválida: "${text.absenteeism_class}". Valores: ${ABSENTEEISM_CLASSES.join(" | ")}`, text.absenteeism_class);
    }
    let counts: boolean | null = null;
    const countsRaw = (text.counts_as_absence ?? "").toLowerCase();
    if (countsRaw) {
      if (TRUE_VALUES.has(countsRaw)) counts = true;
      else if (FALSE_VALUES.has(countsRaw)) counts = false;
      else err("counts_as_absence", `Valor inválido: "${text.counts_as_absence}". Usar 1 | 0 | si | no`, text.counts_as_absence);
    }

    if (errors.length === 0) {
      validRows.push({
        source_row: rowIndex,
        employee_code: text.employee_code!,
        absenteeism_type_code: text.absenteeism_type_code!,
        start_date: start!,
        end_date: end!,
        days_count: days,
        hours_count: hours,
        justified: text.justified || "0",
        status,
        notes: text.notes ? text.notes : null,
        absenteeism_type_name: text.absenteeism_type_name ? text.absenteeism_type_name : null,
        absenteeism_class: cls || null,
        counts_as_absence: counts,
      });
    } else {
      allErrors.push(...errors);
    }
  }

  return { rows: validRows, errors: allErrors };
}
