"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@wla/ui";
import { Clock, CheckCircle2, XCircle, Loader2, RotateCcw, AlertTriangle } from "lucide-react";

interface JobResult {
  rows_read?: number;
  rows_ok?: number;
  rows_error?: number;
  people_inserted?: number;
  people_updated?: number;
  org_units_upserted?: number;
  parse_errors?: unknown[];
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

function JobStats({ result }: { result: unknown }) {
  const r = result as JobResult | null;
  if (!r || typeof r !== "object") return null;
  if (typeof r.rows_ok !== "number") return null;

  return (
    <div className="flex gap-3 text-xs text-muted-foreground">
      {typeof r.people_inserted === "number" && r.people_inserted > 0 && (
        <span className="text-green-600 dark:text-green-400">+{r.people_inserted} nuevos</span>
      )}
      {typeof r.people_updated === "number" && r.people_updated > 0 && (
        <span>{r.people_updated} actualizados</span>
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
              {job.lastError && (
                <p className="text-xs text-destructive line-clamp-2">{job.lastError}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
