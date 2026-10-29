import { withTenantContext } from "@wla/auth";
import { summarizeJob, type JobSummary } from "./job-result";

export type HistoryFilter = "all" | "ok" | "errors" | "failed";

export interface JobHistoryPage {
  items: JobSummary[];
  total: number;
  page: number;
  pages: number;
}

/** Cargas que se miran para paginar y filtrar el historial */
const HISTORY_WINDOW = 200;

const FIELDS = { id: true, status: true, createdAt: true, finishedAt: true, payload: true, result: true, lastError: true } as const;

/**
 * Historial de cargas de una integración, de la más reciente a la más antigua. El filtro por estado se resuelve
 * con un conteo liviano de errores por carga; el detalle (con los errores) solo se trae para la página pedida.
 */
export async function loadJobHistory(
  tenantId: string,
  integrationId: number,
  opts: { page: number; pageSize: number; filter?: HistoryFilter }
): Promise<JobHistoryPage> {
  const { pageSize, filter = "all" } = opts;
  return withTenantContext(tenantId, async (tx) => {
    const light = await tx.$queryRaw<{ id: number; status: string; err: number }[]>`
      SELECT id, status,
        GREATEST(
          COALESCE((result->>'rows_error')::int, 0),
          COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(result->'errors') = 'array' THEN result->'errors' END), 0)
            + COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(result->'parse_errors') = 'array' THEN result->'parse_errors' END), 0)
        )::int AS err
      FROM jobs
      WHERE tenant_id = ${tenantId}::uuid AND integration_id = ${integrationId}
      ORDER BY created_at DESC
      LIMIT ${HISTORY_WINDOW}`;

    const stateOf = (r: { status: string; err: number }): HistoryFilter | "running" => {
      if (r.status === "pending" || r.status === "running" || r.status === "retry_scheduled") return "running";
      if (r.status === "completed") return r.err > 0 ? "errors" : "ok";
      return "failed";
    };
    const matching = light.filter((r) => filter === "all" || stateOf(r) === filter);
    const total = matching.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, opts.page), pages);
    const ids = matching.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id);
    if (ids.length === 0) return { items: [], total, page, pages };

    const rows = await tx.job.findMany({ where: { tenantId, integrationId, id: { in: ids } }, select: FIELDS });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [summarizeJob(row)] : [];
    });
    return { items, total, page, pages };
  });
}

/** Una carga puntual (para seguir su avance después de subir el archivo) */
export async function loadJobSummary(tenantId: string, jobId: number): Promise<JobSummary | null> {
  return withTenantContext(tenantId, async (tx) => {
    const row = await tx.job.findFirst({ where: { id: jobId, tenantId }, select: FIELDS });
    return row ? summarizeJob(row) : null;
  });
}
