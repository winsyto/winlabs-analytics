// Modelo canónico de una fila de personas parseada
export interface PersonRow {
  employee_code: string;
  full_name: string;
  hire_date: string;          // ISO date string "YYYY-MM-DD"
  status: string;             // "active" | "inactive" | raw value del cliente
  email: string | null;
  birth_date: string | null;  // ISO date string o null
  gender: string | null;
  document_type: string | null;
  document_number: string | null;
  contract_type: string | null;
  manager_code: string | null;
  area_code: string | null;
  area_name: string | null;
  position_code: string | null;
  position_name: string | null;
}

// Config almacenado en IntTenantIntegration.config
export interface FilePeopleConfig {
  // Mapeo columna_canónica → nombre_en_el_archivo
  // Si una columna no está en el mapa, se asume que el nombre es el mismo
  columnMapping?: Partial<Record<keyof PersonRow, string>>;
  // Formato de fechas en el archivo (default: "YYYY-MM-DD")
  dateFormat?: string;
  // Separador para CSV (default: ",")
  csvDelimiter?: string;
  // Fila de encabezado (default: true)
  hasHeader?: boolean;
}

export interface ParseResult {
  rows: PersonRow[];
  errors: ParseError[];
}

export interface ParseError {
  rowIndex: number;
  field: string;
  message: string;
  rawValue?: string;
}
