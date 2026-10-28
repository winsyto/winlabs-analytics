import Link from "next/link";
import { auth } from "@/auth";
import { AlertTriangle, CheckCircle2, Clock, Database, Loader2, Upload, XCircle } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { fmtInt, monthLabel } from "../_dashboard-kit/format";
import { loadDataStatus, type SourceState } from "./_data/data-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inicio" };

const STATE: Record<SourceState, { label: string; cls: string; icon: React.ReactNode }> = {
  ok: { label: "Al día", cls: "border-green-300 bg-green-50 text-green-900", icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> },
  stale: { label: "Desactualizado", cls: "border-amber-300 bg-amber-50 text-amber-900", icon: <Clock className="h-3.5 w-3.5" aria-hidden /> },
  errors: { label: "Cargado con errores", cls: "border-amber-300 bg-amber-50 text-amber-900", icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> },
  failed: { label: "Falló la última carga", cls: "border-red-300 bg-red-50 text-red-900", icon: <XCircle className="h-3.5 w-3.5" aria-hidden /> },
  running: { label: "Procesando", cls: "border-blue-300 bg-blue-50 text-blue-900", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> },
  never: { label: "Sin cargas", cls: "bg-muted text-muted-foreground", icon: <Database className="h-3.5 w-3.5" aria-hidden /> },
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
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.icon}
                          {st.label}
                        </span>
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
