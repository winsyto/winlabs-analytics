"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@wla/ui";
import { Clock, CheckCircle2, XCircle, Loader2, RotateCcw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface RowError {
  row: number;
  employee_code?: string;
  field?: string;
  message: string;
}

interface JobResult {
  rows_read?: number;
  rows_ok?: number;
  rows_inserted?: number;
  rows_updated?: number;
  rows_skipped?: number;
  rows_error?: number;
  people_inserted?: number;
  people_updated?: number;
  org_units_upserted?: number;
  errors?: RowError[];
  parse_errors?: RowError[];
}

interface Job {
  id: number;
  status: string;
  createdAt: Date;
  finishedAt: Date | null;
  result: unknown;
  lastError: string | null;
}

interface JobsTableProps {
  jobs: Job[];
}

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
}> = {
  pending:         { label: "Pendiente",  variant: "outline",     icon: <Clock className="h-3 w-3" /> },
  running:         { label: "Procesando", variant: "secondary",   icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed:       { label: "Completado", variant: "default",     icon: <CheckCircle2 className="h-3 w-3" /> },
  failed:          { label: "Fallido",    variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  retry_scheduled: { label: "Reintento", variant: "secondary",   icon: <RotateCcw className="h-3 w-3" /> },
};

function formatDuration(created: Date, finished: Date | null): string {
  if (!finished) return "—";
  const ms = new Date(finished).getTime() - new Date(created).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getResult(result: unknown): JobResult | null {
  if (!result || typeof result !== "object") return null;
  return result as JobResult;
}

function JobStats({ result }: { result: unknown }) {
  const r = getResult(result);
  if (!r) return null;

  const inserted = r.people_inserted ?? r.rows_inserted ?? 0;
  const updated = r.people_updated ?? r.rows_updated ?? 0;
  const skipped = r.rows_skipped ?? 0;

  if (typeof r.rows_ok !== "number" && !inserted && !updated) return null;

  return (
    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
      {inserted > 0 && (
        <span className="text-green-600 dark:text-green-400">+{inserted} nuevos</span>
      )}
      {updated > 0 && (
        <span>{updated} actualizados</span>
      )}
      {skipped > 0 && (
        <span>{skipped} sin persona</span>
      )}
      {typeof r.rows_error === "number" && r.rows_error > 0 && (
        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {r.rows_error} con error
        </span>
      )}
    </div>
  );
}

function JobErrors({ result, jobFailed, lastError }: { result: unknown; jobFailed: boolean; lastError: string | null }) {
  const [open, setOpen] = useState(true);
  const r = getResult(result);

  // Combine SQL row errors + parse errors
  const rowErrors: RowError[] = [
    ...(r?.errors ?? []),
    ...(r?.parse_errors ?? []),
  ].slice(0, 20);

  const totalErrors = (r?.errors?.length ?? 0) + (r?.parse_errors?.length ?? 0);
  const hasRowErrors = rowErrors.length > 0;
  const hasJobError = jobFailed && lastError;

  if (!hasRowErrors && !hasJobError) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {hasRowErrors ? `Ver errores (${totalErrors})` : "Ver detalle del error"}
      </button>

      {open && (
        <div className="mt-2 rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
          {hasJobError && (
            <p className="text-xs text-destructive font-mono">{lastError}</p>
          )}
          {hasRowErrors && (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-amber-200 dark:border-amber-900">
                    <th className="text-left py-1 pr-3 font-medium w-12">Fila</th>
                    <th className="text-left py-1 pr-3 font-medium w-28">Empleado</th>
                    <th className="text-left py-1 font-medium">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {rowErrors.map((e, i) => (
                    <tr key={i} className="border-b border-amber-100 dark:border-amber-900/50 last:border-0">
                      <td className="py-1 pr-3 text-muted-foreground">{e.row}</td>
                      <td className="py-1 pr-3 font-mono text-muted-foreground">{e.employee_code ?? "—"}</td>
                      <td className="py-1 text-foreground">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalErrors > 20 && (
                <p className="text-xs text-muted-foreground pt-1">… y {totalErrors - 20} errores más</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Refresca la página si hay jobs en estados transitorios
function useJobPolling(jobs: Job[]) {
  const router = useRouter();
  const hasPending = jobs.some((j) => j.status === "pending" || j.status === "running");

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [hasPending, router]);
}

export function JobsTable({ jobs }: JobsTableProps) {
  useJobPolling(jobs);

  if (jobs.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium text-sm">Últimos procesamientos</h3>
      </div>
      <div className="divide-y">
        {jobs.map((job) => {
          const cfg = STATUS_CONFIG[job.status] ?? { label: job.status, variant: "outline" as const, icon: null };
          const jobFailed = job.status === "failed";
          return (
            <div key={job.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <Badge variant={cfg.variant} className="flex items-center gap-1">
                    {cfg.icon}
                    {cfg.label}
                  </Badge>
                  <div>
                    <span className="text-foreground">Job #{job.id}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {new Date(job.createdAt).toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(job.createdAt, job.finishedAt)}
                </span>
              </div>
              <JobStats result={job.result} />
              <JobErrors result={job.result} jobFailed={jobFailed} lastError={job.lastError} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
