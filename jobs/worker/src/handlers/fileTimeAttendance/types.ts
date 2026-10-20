/** Una fila del archivo: horas de un tipo para una persona en un día. */
export interface TimeEntryRow {
  /** Fila del archivo (como se ve en Excel) para informar errores */
  source_row: number;
  employee_code: string;
  date: string;             // YYYY-MM-DD
  time_entry_type: string;  // código del tipo de hora (OT50, REGULAR, ...)
  hours: string;            // decimal, 0 a 24
}

export interface FileTimeAttendanceConfig {
  columnMapping?: Partial<Record<keyof Omit<TimeEntryRow, "source_row">, string>>;
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
  rows: TimeEntryRow[];
  errors: ParseError[];
}
