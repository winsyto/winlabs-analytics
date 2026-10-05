export interface PayrollRow {
  employee_code: string;
  period_code: string;      // e.g. "2026-01"
  period_start: string;     // YYYY-MM-DD
  period_end: string;       // YYYY-MM-DD
  concept_code: string;
  concept_name: string;
  concept_category: string; // basic_salary|bonus|overtime|absence_deduction|other
  amount: string;           // decimal string
  hours: string | null;     // decimal string, optional
}

export interface FilePayrollConfig {
  columnMapping?: Partial<Record<keyof PayrollRow, string>>;
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
