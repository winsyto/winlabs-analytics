export interface OrgHistoryRow {
  employee_code: string;
  org_unit_type: string;
  org_unit_code: string;
  org_unit_name: string | null;
  valid_from: string;
  valid_to: string | null;
  /** Fila de la planilla de origen (para mensajes de error) */
  source_row?: number;
}

export interface FileOrgHistoryConfig {
  // Mapeo columna_canónica → nombre_en_el_archivo
  columnMapping?: Record<string, string>;
  csvDelimiter?: string;
  hasHeader?: boolean;
}

export interface ParseError {
  rowIndex: number;
  employee_code?: string;
  field: string;
  message: string;
  rawValue?: string;
}

export interface ParseResult {
  rows: OrgHistoryRow[];
  errors: ParseError[];
}
