import { describeJob, durationLabel, formatWhen, type JobSummary } from "../_data/job-result";
import { HistoryDialog } from "./history-dialog";
import { StatusPill } from "./status-pill";

/** Las últimas cargas de la integración (solo las más recientes); el resto está en el historial completo */
export function RecentRuns({ integrationId, integrationName, jobs }: { integrationId: number; integrationName: string; jobs: JobSummary[] }) {
  return (
    <section className="rounded-lg border bg-card" aria-labelledby="recent-title">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h2 id="recent-title" className="text-sm font-semibold">Últimas cargas</h2>
        <HistoryDialog integrationId={integrationId} integrationName={integrationName} />
      </div>
      {jobs.length === 0 ? (
        <p className="border-t px-4 py-4 text-sm text-muted-foreground">Todavía no hay cargas para esta integración.</p>
      ) : (
        <ul className="divide-y border-t">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {formatWhen(job.createdAt)}
                  {job.filename && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{job.filename}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {describeJob(job)}
                  {durationLabel(job) && ` · ${durationLabel(job)}`}
                </p>
              </div>
              <StatusPill kind={job.state} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
