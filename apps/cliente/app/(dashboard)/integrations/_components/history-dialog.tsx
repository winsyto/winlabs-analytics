"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@wla/ui";
import { getJobHistoryAction } from "../_actions/history.actions";
import { MAX_STORED_ERRORS, describeJob, formatWhen } from "../_data/job-result";
import type { HistoryFilter, JobHistoryPage } from "../_data/queries";
import { ErrorsTable, JobNotices } from "./job-result-view";
import { StatusPill } from "./status-pill";

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "ok", label: "Correctas" },
  { value: "errors", label: "Con errores" },
  { value: "failed", label: "Fallidas" },
];

/** Botón «Ver historial completo» y su ventana: cargas paginadas de a 12, con filtro por estado */
export function HistoryDialog({ integrationId, integrationName }: { integrationId: number; integrationName: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [data, setData] = useState<JobHistoryPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const res = await getJobHistoryAction({ integrationId, page, filter });
      setFailed(res === null);
      if (res) setData(res);
    });
  }, [open, page, filter, integrationId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History aria-hidden /> Ver historial completo
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Historial de cargas</DialogTitle>
          <DialogDescription>{integrationName}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-5 py-2">
          <label htmlFor="history-filter" className="text-xs text-muted-foreground">Estado</label>
          <select
            id="history-filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as HistoryFilter);
              setPage(1);
            }}
            className="rounded-md border bg-card px-2 py-1 text-sm"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {failed ? (
            <p role="alert" className="p-6 text-center text-sm text-wla-bad">No se pudo leer el historial. Cerrá la ventana y probá de nuevo.</p>
          ) : !data ? (
            <p role="status" className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No hay cargas para este filtro.</p>
          ) : (
            <ul className={`divide-y ${pending ? "opacity-60" : ""}`}>
              {data.items.map((job) => (
                <li key={job.id} className="space-y-1.5 px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatWhen(job.createdAt)}
                        {job.filename && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{job.filename}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{describeJob(job)}</p>
                    </div>
                    <StatusPill kind={job.state} />
                  </div>
                  {(job.errorRows > 0 || job.notes.length > 0 || job.warnings.length > 0 || (job.state === "failed" && job.lastError)) && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                        {job.errorRows > 0 ? `Ver errores (${job.errorRows})` : "Ver detalle"}
                      </summary>
                      <div className="mt-2 space-y-2">
                        <JobNotices job={job} />
                        <ErrorsTable job={job} />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2 text-xs text-muted-foreground">
          <span>
            {data ? `Página ${data.page} de ${data.pages} · ${data.total} ${data.total === 1 ? "carga" : "cargas"}` : ""} · el detalle guarda los primeros {MAX_STORED_ERRORS} errores de cada archivo
          </span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data || data.page <= 1 || pending} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft aria-hidden /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!data || data.page >= data.pages || pending} onClick={() => setPage((p) => p + 1)}>
              Siguiente <ChevronRight aria-hidden />
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
