import { parseRawRows, buildReverseMap, parseDate, parseDecimal } from "../shared/parseFile.js";
import type { AbsenteeismRow, FileAbsenteeismConfig, ParseResult, ParseError } from "./types.js";

const FIELDS = [
  "employee_code", "absenteeism_type_code", "start_date", "end_date",
  "days_count", "hours_count", "justified", "status", "notes",
] as const;

const REQUIRED: (keyof AbsenteeismRow)[] = [
  "employee_code", "absenteeism_type_code", "start_date", "end_date",
];

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
    const row: Partial<AbsenteeismRow> = {};
    const errors: ParseError[] = [];

    for (const [rawKey, rawValue] of Object.entries(raw)) {
      const canonical = reverseMap.get(rawKey.toLowerCase().trim());
      if (!canonical) continue;
      const value = rawValue?.trim() ?? "";

      if (canonical === "start_date" || canonical === "end_date") {
        const parsed = parseDate(value);
        if (!parsed && value !== "") {
          errors.push({ rowIndex: i + 1, field: canonical, message: `Fecha inválida: "${value}"`, rawValue: value });
        }
        row[canonical] = parsed ?? "";
      } else if (canonical === "days_count" || canonical === "hours_count") {
        row[canonical] = parseDecimal(value) ?? "0";
      } else if (canonical === "notes") {
        row.notes = value === "" ? null : value;
      } else {
        (row as Record<string, string>)[canonical] = value === "" ? "" : value;
      }
    }

    if (!row.status) row.status = "open";
    if (!row.justified) row.justified = "0";

    for (const field of REQUIRED) {
      if (!row[field]) {
        errors.push({ rowIndex: i + 1, field, message: `Campo requerido vacío: ${field}` });
      }
    }

    if (errors.length === 0) {
      validRows.push(row as AbsenteeismRow);
    } else {
      allErrors.push(...errors);
    }
  }

  return { rows: validRows, errors: allErrors };
}
