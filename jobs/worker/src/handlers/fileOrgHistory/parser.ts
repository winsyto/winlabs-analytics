import { parseRawRows, parseDate } from "../shared/parseFile.js";
import type { TenantOrgSchema } from "../shared/orgSchema.js";
import type { FileOrgHistoryConfig, OrgHistoryRow, ParseError, ParseResult } from "./types.js";

const FIELDS = [
  "employee_code",
  "org_unit_type",
  "org_unit_code",
  "org_unit_name",
  "valid_from",
  "valid_to",
] as const;
type Field = (typeof FIELDS)[number];
const REQUIRED: Field[] = ["employee_code", "org_unit_type", "org_unit_code", "valid_from"];

const norm = (s: string) => s.toLowerCase().trim();

export async function parseFileOrgHistory(
  buffer: Buffer,
  filename: string,
  cfg: FileOrgHistoryConfig,
  orgSchema: TenantOrgSchema
): Promise<ParseResult> {
  const rawRows = await parseRawRows(buffer, filename, cfg);
  if (rawRows.length === 0) throw new Error("El archivo no tiene filas de datos.");

  const mapping = cfg.columnMapping ?? {};
  const reverse = new Map<string, Field>(FIELDS.map((f) => [norm(mapping[f] ?? f), f]));
  const headers = new Set(Object.keys(rawRows[0]!).map(norm));
  const missing = REQUIRED.filter((f) => !headers.has(norm(mapping[f] ?? f)));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas obligatorias en el archivo: ${missing.join(", ")}`);
  }

  const rows: OrgHistoryRow[] = [];
  const errors: ParseError[] = [];
  const enabled = new Set(orgSchema.enabledTypes);

  for (let i = 0; i < rawRows.length; i++) {
    // Número de fila como lo ve el usuario en la planilla (la fila 1 es el encabezado)
    const rowIndex = cfg.hasHeader === false ? i + 1 : i + 2;
    const rowErrors: ParseError[] = [];
    const err = (field: string, message: string, rawValue?: string) =>
      rowErrors.push({
        rowIndex,
        field,
        message,
        ...(v.employee_code ? { employee_code: v.employee_code } : {}),
        ...(rawValue !== undefined ? { rawValue } : {}),
      });

    const v: Partial<Record<Field, string>> = {};
    for (const [rawKey, rawValue] of Object.entries(rawRows[i]!)) {
      const field = reverse.get(norm(rawKey));
      const value = (rawValue ?? "").trim();
      if (field && value !== "") v[field] = value;
    }
    for (const f of REQUIRED) if (!v[f]) err(f, `Campo requerido vacío: ${f}`);

    const type = v.org_unit_type?.toUpperCase();
    if (type && !enabled.has(type)) {
      err("org_unit_type", `Tipo de unidad no habilitado para el tenant: "${v.org_unit_type}"`, v.org_unit_type);
    }
    if (v.org_unit_code && v.org_unit_code.length > 50) err("org_unit_code", "Excede 50 caracteres", v.org_unit_code);
    if (v.org_unit_name && v.org_unit_name.length > 150) err("org_unit_name", "Excede 150 caracteres", v.org_unit_name);

    const from = v.valid_from ? parseDate(v.valid_from) : null;
    if (v.valid_from && !from) err("valid_from", `Fecha inválida: "${v.valid_from}"`, v.valid_from);
    const to = v.valid_to ? parseDate(v.valid_to) : null;
    if (v.valid_to && !to) err("valid_to", `Fecha inválida: "${v.valid_to}"`, v.valid_to);
    if (from && to && to < from) err("valid_to", "valid_to es anterior a valid_from");

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    rows.push({
      employee_code: v.employee_code!,
      org_unit_type: type!,
      org_unit_code: v.org_unit_code!,
      org_unit_name: v.org_unit_name ?? null,
      valid_from: from!,
      valid_to: to,
      source_row: rowIndex,
    });
  }

  return validateGroups(rows, errors);
}

/**
 * Cada (persona, tipo) es un historial completo: períodos sin solapamiento y solo el último puede estar abierto.
 * Si un grupo es inválido se rechaza completo (no se carga un historial a medias).
 */
function validateGroups(rows: OrgHistoryRow[], errors: ParseError[]): ParseResult {
  const groups = new Map<string, { row: OrgHistoryRow; rowIndex: number }[]>();
  rows.forEach((row, idx) => {
    const key = `${row.employee_code}|${row.org_unit_type}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push({ row, rowIndex: row.source_row ?? idx + 1 });
  });

  const valid: OrgHistoryRow[] = [];
  for (const [key, items] of groups) {
    items.sort((a, b) => a.row.valid_from.localeCompare(b.row.valid_from));
    let problem: string | null = null;
    for (let i = 0; i < items.length - 1 && !problem; i++) {
      const cur = items[i]!.row;
      const next = items[i + 1]!.row;
      if (cur.valid_to === null) problem = `Hay un período abierto (sin valid_to) que no es el último (desde ${cur.valid_from})`;
      else if (next.valid_from <= cur.valid_to) problem = `Períodos solapados: ${cur.valid_from}–${cur.valid_to} y desde ${next.valid_from}`;
    }
    if (problem) {
      const [code, type] = key.split("|");
      errors.push({ rowIndex: items[0]!.rowIndex, field: "valid_from", message: `Historial de ${code} (${type}) rechazado: ${problem}` });
    } else {
      valid.push(...items.map((it) => it.row));
    }
  }
  return { rows: valid, errors };
}
