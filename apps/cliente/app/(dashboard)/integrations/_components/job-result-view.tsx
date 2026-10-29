"use client";

import { Download, Info } from "lucide-react";
import { Button } from "@wla/ui";
import { MAX_STORED_ERRORS, errorsToCsv, type JobSummary } from "../_data/job-result";

/** Descarga las filas con error guardadas como CSV */
export function downloadErrors(job: Pick<JobSummary, "id" | "errors">) {
  const blob = new Blob([errorsToCsv(job.errors)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `errores-carga-${job.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ErrorsTable({ job }: { job: JobSummary }) {
  if (job.errors.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th scope="col" className="w-14 px-3 py-1.5 font-medium">Fila</th>
              <th scope="col" className="w-32 px-3 py-1.5 font-medium">Empleado</th>
              <th scope="col" className="px-3 py-1.5 font-medium">Mensaje</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {job.errors.slice(0, 20).map((e, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5 tabular-nums">{e.row ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono">{e.employee_code ?? "—"}</td>
                <td className="px-3 py-1.5">
                  {e.field && <span className="font-mono text-muted-foreground">{e.field}: </span>}
                  {e.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {job.errors.length > 20 ? `Se muestran 20 de ${job.errors.length}. ` : ""}
          {job.errorRows > MAX_STORED_ERRORS
            ? `El detalle guarda los primeros ${MAX_STORED_ERRORS} de ${job.errorRows} errores.`
            : job.errors.length > 20
              ? "El CSV trae todos."
              : ""}
        </span>
        <Button variant="outline" size="sm" onClick={() => downloadErrors(job)}>
          <Download aria-hidden /> Descargar errores (CSV)
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | null; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className={`text-xl font-semibold tabular-nums ${tone === "bad" ? "text-wla-bad" : tone === "good" ? "text-wla-good" : "text-foreground"}`}>
        {value === null ? "—" : value.toLocaleString("es-AR")}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export function JobStats({ job }: { job: JobSummary }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      <Stat label="Filas leídas" value={job.read} />
      <Stat label="Cargadas" value={job.loaded} tone="good" />
      <Stat label="Nuevas" value={job.inserted} />
      <Stat label="Actualizadas" value={job.updated} />
      <Stat label="Omitidas" value={job.skipped ?? 0} />
      <Stat label="Con error" value={job.errorRows} tone={job.errorRows > 0 ? "bad" : undefined} />
    </div>
  );
}

/** Avisos del procesamiento (primero) y errores del archivo */
export function JobNotices({ job }: { job: JobSummary }) {
  const items = [...job.notes, ...job.warnings];
  if (items.length === 0 && !(job.state === "failed" && job.lastError)) return null;
  return (
    <div className="space-y-2">
      {job.state === "failed" && job.lastError && (
        <p className="rounded-md border border-wla-bad/40 bg-wla-bad/5 px-3 py-2 font-mono text-xs text-wla-bad">{job.lastError}</p>
      )}
      {items.length > 0 && (
        <div className="flex gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">{items.length === 1 ? "Aviso" : "Avisos"}</p>
            {items.map((w, i) => (
              <p key={i} className="text-muted-foreground">{w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Detalle completo de una carga terminada: resumen, avisos y errores */
export function JobDetail({ job }: { job: JobSummary }) {
  return (
    <div className="space-y-3">
      {job.state !== "failed" && <JobStats job={job} />}
      <JobNotices job={job} />
      {job.errorRows > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Filas con error ({job.errorRows}) <span className="font-normal text-muted-foreground">· no se cargaron; el resto del archivo sí</span>
          </p>
          <ErrorsTable job={job} />
        </div>
      )}
    </div>
  );
}
