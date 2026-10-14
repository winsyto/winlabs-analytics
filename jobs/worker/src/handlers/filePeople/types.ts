export interface OrgUnitCell {
  code: string;
  name: string | null;
}

export type PersonStatus = "active" | "inactive" | "on_leave";

// Modelo canónico de una fila de personas parseada
export interface PersonRow {
  employee_code: string;
  full_name: string;
  hire_date: string;          // ISO date string "YYYY-MM-DD"
  status: PersonStatus;
  email: string | null;
  birth_date: string | null;
  gender: string | null;
  document_type: string | null;
  document_number: string | null;
  manager_code: string | null;
  termination_date: string | null;
  termination_reason_code: string | null;
  /** Unidades organizativas por tipo (AREA, LOCATION, CONTRACT, ...). Solo los tipos con código en la fila. */
  org_units: Record<string, OrgUnitCell>;
}

// Config almacenado en IntTenantIntegration.config
export interface FilePeopleConfig {
  // Mapeo columna_canónica → nombre_en_el_archivo (ej: { area_code: "cod_area" })
  columnMapping?: Record<string, string>;
  // Formato de fechas en el archivo (default: "YYYY-MM-DD")
  dateFormat?: string;
  // Separador para CSV (default: ",")
  csvDelimiter?: string;
  // Fila de encabezado (default: true)
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
  rows: PersonRow[];
  errors: ParseError[];
  /** Columnas del archivo ignoradas (tipo de unidad no habilitado o columna desconocida de unidad) */
  warnings: string[];
}
