import { parseRawRows, parseDate } from "../shared/parseFile.js";
import { typeCodeColumn, typeNameColumn, type TenantOrgSchema } from "../shared/orgSchema.js";
import type {
  FilePeopleConfig,
  ParseError,
  ParseResult,
  PersonRow,
  PersonStatus,
} from "./types.js";

const BASE_FIELDS = [
  "employee_code",
  "full_name",
  "hire_date",
  "status",
  "email",
  "birth_date",
  "gender",
  "document_type",
  "document_number",
  "manager_code",
  "termination_date",
  "termination_reason_code",
  "contract_type", // columna legada: se interpreta como el código de la unidad CONTRACT
] as const;
type BaseField = (typeof BASE_FIELDS)[number];

const REQUIRED_BASE: BaseField[] = ["employee_code", "full_name", "hire_date", "status"];

const MAX_LEN: Partial<Record<BaseField, number>> = {
  employee_code: 50,
  full_name: 200,
  email: 255,
  gender: 20,
  document_type: 30,
  document_number: 50,
  manager_code: 50,
  termination_reason_code: 50,
  contract_type: 30,
};
const MAX_UNIT_CODE = 50;
const MAX_UNIT_NAME = 150;

const STATUS_ALIASES: Record<string, PersonStatus> = {
  active: "active",
  activo: "active",
  inactive: "inactive",
  inactivo: "inactive",
  terminated: "inactive",
  baja: "inactive",
  on_leave: "on_leave",
  licencia: "on_leave",
  leave: "on_leave",
};

export interface ParseContext {
  orgSchema: TenantOrgSchema;
  terminationReasons: Set<string>;
  /** YYYY-MM-DD */
  today: string;
}

type ColumnTarget =
  | { kind: "base"; field: BaseField }
  | { kind: "org"; type: string; part: "code" | "name" };

const norm = (s: string) => s.toLowerCase().trim();

function buildColumnMap(ctx: ParseContext, cfg: FilePeopleConfig): Map<string, ColumnTarget> {
  const mapping = cfg.columnMapping ?? {};
  const map = new Map<string, ColumnTarget>();
  const nameOf = (canonical: string) => norm(mapping[canonical] ?? canonical);

  for (const field of BASE_FIELDS) map.set(nameOf(field), { kind: "base", field });
  for (const type of ctx.orgSchema.enabledTypes) {
    map.set(nameOf(typeCodeColumn(type)), { kind: "org", type, part: "code" });
    map.set(nameOf(typeNameColumn(type)), { kind: "org", type, part: "name" });
  }
  return map;
}

/** Verifica que estén las columnas obligatorias; si no, falla todo el archivo con un mensaje claro. */
function assertRequiredColumns(headers: string[], ctx: ParseContext, cfg: FilePeopleConfig): void {
  const mapping = cfg.columnMapping ?? {};
  const present = new Set(headers.map(norm));
  const has = (canonical: string) => present.has(norm(mapping[canonical] ?? canonical));
  const missing: string[] = [];

  for (const f of REQUIRED_BASE) if (!has(f)) missing.push(f);
  for (const type of ctx.orgSchema.requiredTypes) {
    const col = typeCodeColumn(type);
    const legacyContract = type === "CONTRACT" && has("contract_type");
    if (!has(col) && !legacyContract) {
      missing.push(`${col} (${ctx.orgSchema.typeNames[type] ?? type})`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Faltan columnas obligatorias en el archivo: ${missing.join(", ")}`);
  }
}

export async function parseFilePeople(
  buffer: Buffer,
  filename: string,
  cfg: FilePeopleConfig,
  ctx: ParseContext
): Promise<ParseResult> {
  const rawRows = await parseRawRows(buffer, filename, cfg);
  if (rawRows.length === 0) throw new Error("El archivo no tiene filas de datos.");

  const headers = Object.keys(rawRows[0]!);
  assertRequiredColumns(headers, ctx, cfg);

  const columnMap = buildColumnMap(ctx, cfg);
  const warnings: string[] = [];
  const ignoredUnitCols = headers.filter((h) => {
    const key = norm(h);
    if (columnMap.has(key)) return false;
    return /_(code|name)$/.test(key) && key !== "termination_reason_code";
  });
  if (ignoredUnitCols.length > 0) {
    warnings.push(
      `Columnas ignoradas (tipo de unidad no habilitado para el tenant o desconocido): ${ignoredUnitCols.join(", ")}`
    );
  }

  const rows: PersonRow[] = [];
  const errors: ParseError[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < rawRows.length; i++) {
    // Número de fila como lo ve el usuario en la planilla (la fila 1 es el encabezado)
    const rowIndex = cfg.hasHeader === false ? i + 1 : i + 2;
    const rowErrors: ParseError[] = [];
    const err = (field: string, message: string, rawValue?: string) =>
      rowErrors.push({
        rowIndex,
        field,
        message,
        ...(base.employee_code ? { employee_code: base.employee_code } : {}),
        ...(rawValue !== undefined ? { rawValue } : {}),
      });

    const base: Partial<Record<BaseField, string>> = {};
    const unitParts: Record<string, { code?: string; name?: string }> = {};

    for (const [rawKey, rawValue] of Object.entries(rawRows[i]!)) {
      const target = columnMap.get(norm(rawKey));
      if (!target) continue;
      const value = (rawValue ?? "").trim();
      if (value === "") continue;
      if (target.kind === "base") base[target.field] = value;
      else (unitParts[target.type] ??= {})[target.part] = value;
    }

    for (const [field, max] of Object.entries(MAX_LEN) as [BaseField, number][]) {
      const v = base[field];
      if (v && v.length > max) err(field, `Excede ${max} caracteres`, v);
    }
    for (const f of REQUIRED_BASE) if (!base[f]) err(f, `Campo requerido vacío: ${f}`);

    // Fechas
    const dateOrError = (field: "hire_date" | "birth_date" | "termination_date"): string | null => {
      const raw = base[field];
      if (!raw) return null;
      const parsed = parseDate(raw);
      if (!parsed) err(field, `Fecha inválida: "${raw}"`, raw);
      return parsed;
    };
    const hire = dateOrError("hire_date");
    const birth = dateOrError("birth_date");
    const termination = dateOrError("termination_date");

    // Estado
    let status: PersonStatus = "active";
    if (base.status) {
      const mapped = STATUS_ALIASES[norm(base.status)];
      if (!mapped) err("status", `Estado inválido: "${base.status}". Usar active, inactive u on_leave`, base.status);
      else status = mapped;
    }

    // Baja
    const reason = base.termination_reason_code ?? null;
    if (status === "inactive") {
      if (!termination) err("termination_date", "Una persona inactiva debe tener fecha de baja (termination_date)");
      if (!reason) err("termination_reason_code", "Una persona inactiva debe tener motivo de baja (termination_reason_code)");
    }
    if (reason && !ctx.terminationReasons.has(reason)) {
      err("termination_reason_code", `Motivo de baja inexistente en el catálogo: "${reason}"`, reason);
    }
    if (status !== "inactive" && termination && termination <= ctx.today) {
      err("termination_date", `Estado "${status}" incompatible con una fecha de baja ya cumplida (${termination})`);
    }
    if (hire && termination && termination < hire) {
      err("termination_date", "La fecha de baja es anterior a la fecha de ingreso");
    }

    // Unidades organizativas
    const orgUnits: PersonRow["org_units"] = {};
    for (const type of ctx.orgSchema.enabledTypes) {
      const part = unitParts[type];
      if (part?.code) {
        if (part.code.length > MAX_UNIT_CODE) err(typeCodeColumn(type), `Excede ${MAX_UNIT_CODE} caracteres`, part.code);
        if (part.name && part.name.length > MAX_UNIT_NAME) err(typeNameColumn(type), `Excede ${MAX_UNIT_NAME} caracteres`, part.name);
        orgUnits[type] = { code: part.code, name: part.name ?? null };
      }
    }
    // Compatibilidad: columna contract_type de archivos anteriores
    if (!orgUnits.CONTRACT && base.contract_type && ctx.orgSchema.enabledTypes.includes("CONTRACT")) {
      orgUnits.CONTRACT = { code: base.contract_type, name: null };
    }
    for (const type of ctx.orgSchema.requiredTypes) {
      if (!orgUnits[type]) {
        err(typeCodeColumn(type), `Falta ${ctx.orgSchema.typeNames[type] ?? type}: la columna ${typeCodeColumn(type)} es obligatoria`);
      }
    }
    const contractCode = orgUnits.CONTRACT?.code ?? null;
    if (contractCode && contractCode.length > MAX_LEN.contract_type!) {
      err("contract_code", `Excede ${MAX_LEN.contract_type} caracteres`, contractCode);
    }

    // Duplicados dentro del archivo
    if (base.employee_code) {
      const first = seen.get(base.employee_code);
      if (first !== undefined) err("employee_code", `employee_code duplicado en el archivo (primera aparición en la fila ${first})`, base.employee_code);
      else seen.set(base.employee_code, rowIndex);
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    rows.push({
      employee_code: base.employee_code!,
      full_name: base.full_name!,
      hire_date: hire!,
      status,
      email: base.email ?? null,
      birth_date: birth,
      gender: base.gender ? base.gender.toUpperCase() : null,
      document_type: base.document_type ?? null,
      document_number: base.document_number ?? null,
      manager_code: base.manager_code ?? null,
      termination_date: termination,
      termination_reason_code: reason,
      org_units: orgUnits,
      contract_type: contractCode,
    });
  }

  return { rows, errors, warnings };
}
