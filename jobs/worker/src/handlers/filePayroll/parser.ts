import { parseRawRows, buildReverseMap, parseDate, parseDecimal } from "../shared/parseFile.js";
import type { PayrollRow, FilePayrollConfig, ParseResult, ParseError } from "./types.js";

const FIELDS = [
  "employee_code", "period_code", "period_start", "period_end",
  "concept_code", "concept_name", "concept_category", "amount", "hours",
] as const;

const REQUIRED: (keyof PayrollRow)[] = [
  "employee_code", "period_code", "period_start", "period_end",
  "concept_code", "concept_name", "concept_category", "amount",
];

export async function parseFilePayroll(
  buffer: Buffer,
  filename: string,
  cfg: FilePayrollConfig = {}
): Promise<ParseResult> {
  const rawRows = await parseRawRows(buffer, filename, cfg);
  const reverseMap = buildReverseMap(FIELDS, cfg.columnMapping);
  const validRows: PayrollRow[] = [];
  const allErrors: ParseError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row: Partial<PayrollRow> = {};
    const errors: ParseError[] = [];

    for (const [rawKey, rawValue] of Object.entries(raw)) {
      const canonical = reverseMap.get(rawKey.toLowerCase().trim());
      if (!canonical) continue;
      const value = rawValue?.trim() ?? "";

      if (canonical === "period_start" || canonical === "period_end") {
        const parsed = parseDate(value);
        if (!parsed && value !== "") {
          errors.push({ rowIndex: i + 1, field: canonical, message: `Fecha inválida: "${value}"`, rawValue: value });
        }
        row[canonical] = parsed ?? "";
      } else if (canonical === "amount") {
        const parsed = parseDecimal(value);
        if (!parsed) {
          errors.push({ rowIndex: i + 1, field: canonical, message: `Monto inválido: "${value}"`, rawValue: value });
        }
        row.amount = parsed ?? "0";
      } else if (canonical === "hours") {
        row.hours = parseDecimal(value);
      } else {
        (row as Record<string, string | null>)[canonical] = value === "" ? null : value;
      }
    }

    for (const field of REQUIRED) {
      if (!row[field]) {
        errors.push({ rowIndex: i + 1, field, message: `Campo requerido vacío: ${field}` });
      }
    }

    if (errors.length === 0) {
      validRows.push(row as PayrollRow);
    } else {
      allErrors.push(...errors);
    }
  }

  return { rows: validRows, errors: allErrors };
}
