/** Clases de tipo de ausencia (mismas que cfg_absenteeism_types.class en la BD). */
export const ABSENTEEISM_CLASSES = [
  "medical", "accident", "unpaid", "unjustified", "suspension", "personal", "other",
  "vacation", "legal_leave", "day_off",
] as const;

/** Clases que por defecto no cuentan como ausentismo. */
export const NON_ABSENCE_CLASSES: readonly string[] = ["vacation", "legal_leave", "day_off"];

export const ABSENTEEISM_STATUSES = ["open", "closed", "cancelled"] as const;

export interface AbsenteeismRow {
  /** Fila del archivo (como se ve en Excel) para informar errores */
  source_row: number;
  employee_code: string;
  absenteeism_type_code: string;
  start_date: string;       // YYYY-MM-DD
  end_date: string;         // YYYY-MM-DD
  /** Días del evento. null = no vino (el dashboard lo calcula con el turno de la persona) */
  days_count: string | null;
  /** Horas de ausencia POR DÍA en una ausencia parcial (4 = medio día). null = día completo */
  hours_count: string | null;
  justified: string;        // "1"|"0"|"true"|"false"|"si"|"no"
  status: string;           // "open"|"closed"|"cancelled"
  notes: string | null;
  /** Solo se usan al crear un tipo nuevo; un tipo existente no se modifica */
  absenteeism_type_name: string | null;
  absenteeism_class: string | null;
  counts_as_absence: boolean | null;
}

export interface FileAbsenteeismConfig {
  columnMapping?: Partial<Record<keyof AbsenteeismRow, string>>;
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
  rows: AbsenteeismRow[];
  errors: ParseError[];
}
