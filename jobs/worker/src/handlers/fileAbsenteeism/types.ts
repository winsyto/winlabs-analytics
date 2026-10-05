export interface AbsenteeismRow {
  employee_code: string;
  absenteeism_type_code: string;
  start_date: string;       // YYYY-MM-DD
  end_date: string;         // YYYY-MM-DD
  days_count: string;       // decimal string
  hours_count: string;      // decimal string
  justified: string;        // "1"|"0"|"true"|"false"|"si"|"no"
  status: string;           // "open"|"closed"|"cancelled"
  notes: string | null;
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
