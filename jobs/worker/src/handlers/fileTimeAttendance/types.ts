export interface TimeAttendanceRow {
  employee_code: string;
  date: string;             // YYYY-MM-DD
  is_working_day: string;   // "1" | "0" | "true" | "false" | "si" | "no"
  scheduled_hours: string;  // decimal string
  worked_hours: string;     // decimal string
  has_absence: string;      // "1" | "0" | "true" | "false"
}

export interface FileTimeAttendanceConfig {
  columnMapping?: Partial<Record<keyof TimeAttendanceRow, string>>;
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
  rows: TimeAttendanceRow[];
  errors: ParseError[];
}
