import { withTenantContext } from "@wla/auth";
import { addMonths, lastClosedMonth } from "../../_dashboard-kit/period";
import { resolveRange } from "../../payroll/_data/queries";

export type SourceState = "ok" | "stale" | "errors" | "failed" | "running" | "never";

export interface SourceStatus {
  integrationId: number;
  name: string;
  templateName: string;
  state: SourceState;
  /** Último archivo cargado */
  lastJob: { at: Date; rows: number | null; errorRows: number } | null;
  /** Primer y último mes con datos (YYYY-MM-01) */
  coverage: { from: string; to: string } | null;
}

const monthOf = (d: Date | null | undefined): string | null => (d ? `${d.toISOString().slice(0, 7)}-01` : null);

interface JobResult {
  rows_read?: number;
  rows_error?: number;
  parse_errors?: unknown[];
}

/**
 * Estado de los datos de cada fuente de archivo del tenant: último archivo cargado, cobertura (meses con datos) y
 * si está al día. Es lo que muestra el Inicio.
 */
export async function loadDataStatus(tenantId: string): Promise<SourceStatus[]> {
  return withTenantContext(tenantId, async (tx) => {
    const integrations = await tx.intTenantIntegration.findMany({
      where: { tenantId, isActive: true, template: { category: "file" } },
      select: { id: true, name: true, integrationTemplateCode: true, template: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (integrations.length === 0) return [];

    const jobs = await tx.job.findMany({
      where: { tenantId, integrationId: { in: integrations.map((i) => i.id) } },
      select: { integrationId: true, status: true, createdAt: true, finishedAt: true, result: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const lastByIntegration = new Map<number, (typeof jobs)[number]>();
    for (const j of jobs) if (j.integrationId !== null && !lastByIntegration.has(j.integrationId)) lastByIntegration.set(j.integrationId, j);

    const [history, time, absence, payroll] = await Promise.all([
      tx.hrPeopleHistory.aggregate({ where: { tenantId }, _min: { snapshotDate: true }, _max: { snapshotDate: true } }),
      tx.attTimeDaily.aggregate({ where: { tenantId }, _min: { date: true }, _max: { date: true } }),
      tx.attAbsenteeismEvent.aggregate({ where: { tenantId }, _min: { startDate: true }, _max: { endDate: true } }),
      resolveRange(tx, tenantId, { p: "month" }),
    ]);
    const span = (from: Date | null | undefined, to: Date | null | undefined) => {
      const a = monthOf(from);
      const b = monthOf(to);
      return a && b ? { from: a, to: b } : null;
    };
    const coverageOf: Record<string, SourceStatus["coverage"]> = {
      file_people: span(history._min.snapshotDate, history._max.snapshotDate),
      file_org_history: span(history._min.snapshotDate, history._max.snapshotDate),
      file_time: span(time._min.date, time._max.date),
      file_absenteeism: span(absence._min.startDate, absence._max.endDate),
      file_payroll: payroll ? { from: payroll.firstMonth, to: payroll.refMonth } : null,
    };
    // Al día = datos hasta el último mes cerrado o el anterior
    const freshFrom = addMonths(lastClosedMonth(), -1);

    return integrations.map((i): SourceStatus => {
      const job = lastByIntegration.get(i.id) ?? null;
      const coverage = coverageOf[i.integrationTemplateCode] ?? null;
      const result = (job?.result ?? null) as JobResult | null;
      const errorRows = (result?.parse_errors?.length ?? 0) + (result?.rows_error ?? 0);
      let state: SourceState;
      if (!job) state = coverage ? (coverage.to >= freshFrom ? "ok" : "stale") : "never";
      else if (job.status === "pending" || job.status === "running" || job.status === "retry_scheduled") state = "running";
      else if (job.status === "failed") state = "failed";
      else if (errorRows > 0) state = "errors";
      else state = coverage && coverage.to < freshFrom ? "stale" : "ok";
      return {
        integrationId: i.id,
        name: i.name,
        templateName: i.template.name,
        state,
        lastJob: job ? { at: job.finishedAt ?? job.createdAt, rows: typeof result?.rows_read === "number" ? result.rows_read : null, errorRows } : null,
        coverage,
      };
    });
  });
}
