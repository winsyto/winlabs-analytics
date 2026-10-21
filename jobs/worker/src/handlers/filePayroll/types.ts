/** Tipos de proceso de liquidación (pay_processes.process_type). */
export const PROCESS_TYPES = [
  "monthly",
  "biweekly",
  "weekly",
  "sac",
  "adjustments",
  "provisions",
  "final_settlement",
  "vacation",
] as const;
export type ProcessType = (typeof PROCESS_TYPES)[number];

/** Una fila del archivo: el importe de un concepto para una persona en un proceso de liquidación. */
export interface PayrollRow {
  /** Fila del archivo (como se ve en Excel) para informar errores */
  source_row: number;
  employee_code: string;
  period_code: string;          // YYYY-MM: el mes de liquidación
  process_code: string;
  process_description: string | null;
  process_type: ProcessType;
  process_start: string;        // YYYY-MM-DD
  process_end: string;          // YYYY-MM-DD
  concept_code: string;
  concept_name: string;
  amount: string;               // decimal con el signo de origen
  quantity: string | null;      // decimal opcional (horas, días, unidades)
}

type CanonicalField = Exclude<keyof PayrollRow, "source_row">;

export interface FilePayrollConfig {
  columnMapping?: Partial<Record<CanonicalField, string>>;
  dateFormat?: string;
  csvDelimiter?: string;
  hasHeader?: boolean;
}

export interface ParseError {
  rowIndex: number;
  field: string;
  message: string;
  rawValue?: string;
}

export interface ParseResult {
  rows: PayrollRow[];
  errors: ParseError[];
}
