import { parseRawRows, buildReverseMap, parseDate, parseDecimal } from "../shared/parseFile.js";
import { PROCESS_TYPES } from "./types.js";
import type { PayrollRow, FilePayrollConfig, ParseResult, ParseError, ProcessType } from "./types.js";

const FIELDS = [
  "employee_code", "period_code", "process_code", "process_description", "process_type",
  "process_start", "process_end", "concept_code", "concept_name", "amount", "quantity",
] as const;
type Field = (typeof FIELDS)[number];

const REQUIRED: Field[] = [
  "employee_code", "period_code", "process_code", "process_start", "process_end",
  "concept_code", "concept_name", "amount",
];

const MAX_LEN: Partial<Record<Field, number>> = {
  employee_code: 50,
  period_code: 20,
  process_code: 50,
  process_description: 200,
  concept_code: 50,
  concept_name: 100,
};

/** Nombres en español (y códigos) aceptados para el tipo de proceso, sin tildes ni mayúsculas. */
const PROCESS_TYPE_ALIASES: Record<string, ProcessType> = {
  monthly: "monthly", mensual: "monthly",
  biweekly: "biweekly", quincenal: "biweekly",
  weekly: "weekly", semanal: "weekly",
  sac: "sac", aguinaldo: "sac",
  adjustments: "adjustments", ajuste: "adjustments", ajustes: "adjustments",
  provisions: "provisions", provision: "provisions", provisiones: "provisions",
  final_settlement: "final_settlement", "liquidacion final": "final_settlement",
  vacation: "vacation", vacaciones: "vacation",
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Importe hasta 12 dígitos enteros (numeric(14,2)); cantidad hasta 4 (numeric(6,2)). */
const MAX_AMOUNT = 1e12;
const MAX_QUANTITY = 1e4;

export async function parseFilePayroll(
  buffer: Buffer,
  filename: string,
  cfg: FilePayrollConfig = {}
): Promise<ParseResult> {
  const rawRows = await parseRawRows(buffer, filename, cfg);

  // Faltan columnas: falla el job entero con la lista (no miles de errores por fila)
  if (rawRows.length > 0) {
    const present = new Set(Object.keys(rawRows[0]!).map((k) => k.toLowerCase().trim()));
    const missing = REQUIRED.filter((f) => !present.has((cfg.columnMapping?.[f] ?? f).toLowerCase().trim()));
    if (missing.length > 0) {
      throw new Error(
        `Faltan columnas obligatorias: ${missing.join(", ")}. El archivo de Liquidaciones lleva una fila por persona, proceso y concepto: ${REQUIRED.join(", ")} (y opcionales process_description, process_type, quantity).`
      );
    }
  }

  const reverseMap = buildReverseMap(FIELDS, cfg.columnMapping);
  const validRows: PayrollRow[] = [];
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

    for (const field of REQUIRED) {
      if (!text[field]) err(field, `Campo requerido vacío: ${field}`);
    }
    for (const [field, max] of Object.entries(MAX_LEN)) {
      const v = text[field as Field] ?? "";
      if (v.length > max) err(field, `${field} supera los ${max} caracteres`, v);
    }

    if (text.period_code && !PERIOD_RE.test(text.period_code)) {
      err("period_code", `El período debe ser un mes con formato AAAA-MM (ej: 2026-09): "${text.period_code}"`, text.period_code);
    }

    const start = parseDate(text.process_start ?? "");
    if (text.process_start && !start) err("process_start", `Fecha inválida: "${text.process_start}"`, text.process_start);
    const end = parseDate(text.process_end ?? "");
    if (text.process_end && !end) err("process_end", `Fecha inválida: "${text.process_end}"`, text.process_end);
    if (start && end && end < start) err("process_end", "La fecha hasta del proceso es anterior a la fecha desde", text.process_end);

    let processType: ProcessType = "monthly";
    if (text.process_type) {
      const t = PROCESS_TYPE_ALIASES[normalize(text.process_type)];
      if (t) processType = t;
      else err("process_type", `Tipo de proceso inválido: "${text.process_type}". Valores: ${PROCESS_TYPES.join(", ")}`, text.process_type);
    }

    let amount: string | null = null;
    if (text.amount) {
      const a = parseDecimal(text.amount);
      if (a === null || !Number.isFinite(Number(a)) || Math.abs(Number(a)) >= MAX_AMOUNT) {
        err("amount", `Importe inválido: "${text.amount}"`, text.amount);
      } else amount = a;
    }

    let quantity: string | null = null;
    if (text.quantity) {
      const q = parseDecimal(text.quantity);
      if (q === null || !Number.isFinite(Number(q)) || Math.abs(Number(q)) >= MAX_QUANTITY) {
        err("quantity", `Cantidad inválida: "${text.quantity}"`, text.quantity);
      } else quantity = q;
    }

    if (errors.length === 0) {
      validRows.push({
        source_row: rowIndex,
        employee_code: text.employee_code!,
        period_code: text.period_code!,
        process_code: text.process_code!,
        process_description: text.process_description || null,
        process_type: processType,
        process_start: start!,
        process_end: end!,
        concept_code: text.concept_code!,
        concept_name: text.concept_name!,
        amount: amount!,
        quantity,
      });
    } else {
      allErrors.push(...errors);
    }
  }

  return { rows: validRows, errors: allErrors };
}
