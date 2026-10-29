import Link from "next/link";
import { auth } from "@/auth";
import { Database, Upload } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { fmtInt, monthLabel } from "../_dashboard-kit/format";
import { StatusPill, type PillKind } from "../integrations/_components/status-pill";
import { loadDataStatus, type SourceState } from "./_data/data-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inicio" };

const STATE: Record<SourceState, { kind: PillKind; label: string }> = {
  ok: { kind: "ok", label: "Al día" },
  stale: { kind: "stale", label: "Desactualizado" },
  errors: { kind: "errors", label: "Cargado con errores" },
  failed: { kind: "failed", label: "Falló la última carga" },
  running: { kind: "running", label: "Procesando" },
  never: { kind: "never", label: "Sin cargas" },
};

const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

export default async function HomePage() {
  const session = await auth();
  const sources = await loadDataStatus(session!.user.tenantId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow="Inicio"
        title="Estado de los datos"
        description={`Hola, ${session?.user?.name}. Acá ves cuándo se cargó cada fuente y hasta qué mes llegan los datos de tus dashboards.`}
      />

      {sources.length === 0 ? (
        <div role="status" className="flex flex-col items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <Database className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Todavía no hay fuentes de datos</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">Pedile a tu administrador de WinLabs que configure las cargas de archivos de tu empresa.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Estado de cada fuente de datos</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th scope="col" className="h-10 px-4 font-medium">Fuente</th>
                  <th scope="col" className="h-10 px-4 font-medium">Último archivo</th>
                  <th scope="col" className="h-10 px-4 font-medium">Datos desde / hasta</th>
                  <th scope="col" className="h-10 px-4 font-medium">Estado</th>
                  <th scope="col" className="h-10 px-4"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sources.map((s) => {
                  const st = STATE[s.state];
                  return (
                    <tr key={s.integrationId}>
                      <th scope="row" className="px-4 py-3 font-medium text-foreground">
                        {s.templateName.replace(/^Archivo:\s*/, "")}
                        <span className="block text-xs font-normal text-muted-foreground">{s.name}</span>
                      </th>
                      <td className="px-4 py-3 text-xs">
                        {s.lastJob ? (
                          <>
                            <span className="tabular-nums text-foreground">{when.format(s.lastJob.at)}</span>
                            <span className="block text-muted-foreground">
                              {s.lastJob.rows !== null ? `${fmtInt(s.lastJob.rows)} filas` : ""}
                              {s.lastJob.errorRows > 0 ? `${s.lastJob.rows !== null ? " · " : ""}${fmtInt(s.lastJob.errorRows)} con error` : ""}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {s.coverage ? `${monthLabel(s.coverage.from)} – ${monthLabel(s.coverage.to)}` : <span className="text-muted-foreground">Sin datos</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill kind={st.kind} label={st.label} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/integrations/${s.integrationId}`}
                          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                        >
                          <Upload className="h-3.5 w-3.5" aria-hidden />
                          Cargar archivo
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
