/**
 * Lectura del resultado que guarda el worker en `jobs.result`, común a los handlers de archivo.
 * Es código puro (sin servidor): lo usan las consultas, las server actions y los componentes.
 */
export interface RowError {
  row?: number;
  employee_code?: string;
  field?: string;
  message: string;
}

/** Estado de una carga, para mostrar */
export type JobState = "running" | "ok" | "errors" | "failed";

export interface JobSummary {
  id: number;
  state: JobState;
  createdAt: string;
  finishedAt: string | null;
  filename: string | null;
  read: number | null;
  loaded: number | null;
  inserted: number | null;
  updated: number | null;
  skipped: number | null;
  /** Filas con error en total (el worker guarda el detalle de las primeras 100) */
  errorRows: number;
  errors: RowError[];
  warnings: string[];
  /** Avisos de negocio derivados de contadores (p. ej. tipos nuevos sin clasificar) */
  notes: string[];
  lastError: string | null;
}

/** Máximo de errores con detalle que guarda el worker por archivo */
export const MAX_STORED_ERRORS = 100;

interface RawResult {
  rows_read?: number;
  rows_inserted?: number;
  rows_updated?: number;
  rows_skipped?: number;
  rows_error?: number;
  people_inserted?: number;
  people_updated?: number;
  types_created?: number;
  concepts_created?: number;
  errors?: RowError[];
  parse_errors?: RowError[];
  warnings?: string[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface JobRowInput {
  id: number;
  status: string;
  createdAt: Date;
  finishedAt: Date | null;
  payload: unknown;
  result: unknown;
  lastError: string | null;
}

export function summarizeJob(job: JobRowInput): JobSummary {
  const r = (job.result && typeof job.result === "object" ? job.result : {}) as RawResult;
  const errors = [...(Array.isArray(r.errors) ? r.errors : []), ...(Array.isArray(r.parse_errors) ? r.parse_errors : [])];
  const errorRows = Math.max(num(r.rows_error) ?? 0, errors.length);

  const inserted = num(r.people_inserted) ?? num(r.rows_inserted);
  const updated = num(r.people_updated) ?? num(r.rows_updated);
  const payload = (job.payload && typeof job.payload === "object" ? job.payload : {}) as { filename?: unknown };

  let state: JobState;
  if (job.status === "pending" || job.status === "running" || job.status === "retry_scheduled") state = "running";
  else if (job.status === "completed") state = errorRows > 0 ? "errors" : "ok";
  else state = "failed";

  const notes: string[] = [];
  const typesCreated = num(r.types_created);
  if (typesCreated && typesCreated > 0) {
    notes.push(`${typesCreated} ${typesCreated === 1 ? "tipo nuevo quedó" : "tipos nuevos quedaron"} sin clasificar: clasificalos en Configuración.`);
  }
  const conceptsCreated = num(r.concepts_created);
  if (conceptsCreated && conceptsCreated > 0) {
    notes.push(`${conceptsCreated} ${conceptsCreated === 1 ? "concepto nuevo quedó" : "conceptos nuevos quedaron"} sin clasificar: clasificalos en Configuración.`);
  }

  return {
    id: job.id,
    state,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
    filename: typeof payload.filename === "string" ? payload.filename : null,
    read: num(r.rows_read),
    loaded: inserted !== null || updated !== null ? (inserted ?? 0) + (updated ?? 0) : null,
    inserted,
    updated,
    skipped: num(r.rows_skipped),
    errorRows,
    errors: errors.slice(0, MAX_STORED_ERRORS),
    warnings: Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === "string") : [],
    notes,
    lastError: job.lastError,
  };
}

export const STATE_LABEL: Record<JobState, string> = {
  running: "Procesando",
  ok: "Correcta",
  errors: "Con errores",
  failed: "Fallida",
};

/** Resumen corto de una carga, para la lista de últimas cargas */
export function describeJob(s: JobSummary): string {
  if (s.state === "running") return "Procesando…";
  if (s.state === "failed") return "No se pudo procesar el archivo";
  const parts: string[] = [];
  if (s.loaded !== null) parts.push(`${s.loaded.toLocaleString("es-AR")} cargadas`);
  else if (s.read !== null) parts.push(`${s.read.toLocaleString("es-AR")} filas leídas`);
  if (s.errorRows > 0) parts.push(`${s.errorRows} con error`);
  return parts.join(" · ") || "Sin detalle";
}

export function durationLabel(s: Pick<JobSummary, "createdAt" | "finishedAt">): string {
  if (!s.finishedAt) return "";
  const ms = new Date(s.finishedAt).getTime() - new Date(s.createdAt).getTime();
  return ms < 1000 ? `${Math.max(ms, 0)} ms` : `${(ms / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} s`;
}

const TZ = "America/Argentina/Buenos_Aires";

/** «Hoy 10:42», «Ayer 18:03», «Hace 3 días» o la fecha */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.round((Date.parse(day(now)) - Date.parse(day(d))) / 86_400_000);
  if (diffDays <= 0) return `Hoy ${time}`;
  if (diffDays === 1) return `Ayer ${time}`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return d.toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

const csvCell = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV (con BOM para Excel) con las filas con error guardadas */
export function errorsToCsv(errors: RowError[]): string {
  const lines = [["Fila", "Empleado", "Campo", "Mensaje"].map(csvCell).join(",")];
  for (const e of errors) lines.push([e.row, e.employee_code, e.field, e.message].map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
