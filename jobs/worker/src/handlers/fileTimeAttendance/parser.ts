import { parseRawRows, buildReverseMap, parseDate, parseBool, parseDecimal } from "../shared/parseFile.js";
import type { TimeAttendanceRow, FileTimeAttendanceConfig, ParseResult, ParseError } from "./types.js";

const FIELDS = [
  "employee_code", "date", "is_working_day",
  "scheduled_hours", "worked_hours", "has_absence",
] as const;

const REQUIRED: (keyof TimeAttendanceRow)[] = ["employee_code", "date", "worked_hours"];

export async function parseFileTimeAttendance(
  buffer: Buffer,
  filename: string,
  cfg: FileTimeAttendanceConfig = {}
): Promise<ParseResult> {
  const rawRows = await parseRawRows(buffer, filename, cfg);
  const reverseMap = buildReverseMap(FIELDS, cfg.columnMapping);
  const validRows: TimeAttendanceRow[] = [];
  const allErrors: ParseError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row: Partial<TimeAttendanceRow> = {};
    const errors: ParseError[] = [];

    for (const [rawKey, rawValue] of Object.entries(raw)) {
      const canonical = reverseMap.get(rawKey.toLowerCase().trim());
      if (!canonical) continue;
      const value = rawValue?.trim() ?? "";

      if (canonical === "date") {
        const parsed = parseDate(value);
        if (!parsed && value !== "") {
          errors.push({ rowIndex: i + 1, field: canonical, message: `Fecha inválida: "${value}"`, rawValue: value });
        }
        row.date = parsed ?? "";
      } else if (canonical === "is_working_day" || canonical === "has_absence") {
        row[canonical] = value;
      } else if (canonical === "scheduled_hours" || canonical === "worked_hours") {
        row[canonical] = parseDecimal(value) ?? "0";
      } else {
        (row as Record<string, string>)[canonical] = value === "" ? "" : value;
      }
    }

    for (const field of REQUIRED) {
      if (!row[field]) {
        errors.push({ rowIndex: i + 1, field, message: `Campo requerido vacío: ${field}` });
      }
    }

    if (errors.length === 0) {
      validRows.push(row as TimeAttendanceRow);
    } else {
      allErrors.push(...errors);
    }
  }

  return { rows: validRows, errors: allErrors };
}
