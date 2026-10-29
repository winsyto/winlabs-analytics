import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet, Info, Upload } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@wla/ui";
import { Breadcrumb } from "../_dashboard-kit/breadcrumb";
import { loadDataStatus, type SourceState, type SourceStatus } from "../dashboard/_data/data-status";
import { StatusPill, type PillKind } from "./_components/status-pill";
import { formatWhen } from "./_data/job-result";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integraciones manuales" };

/** Agrupación de los archivos por tipo de dato, en el orden en que conviene cargarlos */
const GROUPS: { title: string; codes: string[] }[] = [
  { title: "Personas", codes: ["file_people", "file_org_history"] },
  { title: "Asistencia y ausentismo", codes: ["file_time", "file_absenteeism"] },
  { title: "Liquidaciones", codes: ["file_payroll"] },
];

const PILL: Record<SourceState, { kind: PillKind; label?: string }> = {
  ok: { kind: "ok", label: "Al día" },
  stale: { kind: "stale" },
  errors: { kind: "errors", label: "Cargada con errores" },
  failed: { kind: "failed", label: "Falló la última carga" },
  running: { kind: "running" },
  never: { kind: "never" },
};

function groupSources(sources: SourceStatus[]) {
  const known = new Set(GROUPS.flatMap((g) => g.codes));
  const groups = GROUPS.map((g) => ({
    title: g.title,
    items: g.codes.flatMap((c) => sources.filter((s) => s.templateCode === c)),
  }));
  const other = sources.filter((s) => !known.has(s.templateCode));
  if (other.length > 0) groups.push({ title: "Otros", items: other });
  return groups.filter((g) => g.items.length > 0);
}

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const sources = await loadDataStatus(session.user.tenantId);
  const groups = groupSources(sources);
  const peopleNeverLoaded = sources.some((s) => s.templateCode === "file_people" && s.state === "never");

  return (
    <div className="space-y-4 p-6">
      <Breadcrumb items={[{ label: "Data", href: "/data" }, { label: "Integraciones manuales" }]} />
      <PageHeader
        eyebrow="Data"
        title="Integraciones manuales"
        description="Subí archivos de tu sistema de RRHH para actualizar los datos analíticos."
      />

      {sources.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">No hay integraciones de archivo configuradas para tu organización.</p>
          <p className="mt-1 text-xs text-muted-foreground">Contactá a WinLabs para activar integraciones.</p>
        </div>
      ) : (
        <>
          <div role={peopleNeverLoaded ? "alert" : "note"} className="flex gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>
              <span className="font-medium">{peopleNeverLoaded ? "Empezá por Personas." : "Orden recomendado."}</span>{" "}
              Cargá primero Personas y el historial de unidades; el resto de los archivos se relaciona con las personas ya cargadas.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Archivos que se pueden cargar y resultado de la última carga de cada uno</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Archivo</th>
                  <th scope="col" className="px-4 py-2 font-medium">Última carga</th>
                  <th scope="col" className="px-4 py-2 font-medium">Resultado</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g.title} title={g.title} items={g.items} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function GroupRows({ title, items }: { title: string; items: SourceStatus[] }) {
  return (
    <>
      <tr className="bg-muted/40">
        <th scope="colgroup" colSpan={4} className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </th>
      </tr>
      {items.map((s) => {
        const pill = PILL[s.state];
        return (
          <tr key={s.integrationId} className="border-t">
            <th scope="row" className="px-4 py-3 text-left font-normal">
              <Link href={`/integrations/${s.integrationId}`} className="font-semibold hover:underline">
                {s.name}
              </Link>
              <span className="block text-xs text-muted-foreground">{s.templateName.replace(/^Archivo:\s*/, "")}</span>
            </th>
            <td className="px-4 py-3 text-muted-foreground">{s.lastJob ? formatWhen(s.lastJob.at.toISOString()) : "—"}</td>
            <td className="px-4 py-3">
              <StatusPill kind={pill.kind} label={pill.label} />
              {s.lastJob && s.lastJob.rows !== null && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.lastJob.rows.toLocaleString("es-AR")} filas{s.lastJob.errorRows > 0 ? ` · ${s.lastJob.errorRows} con error` : ""}
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                href={`/integrations/${s.integrationId}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden /> Cargar archivo
              </Link>
            </td>
          </tr>
        );
      })}
    </>
  );
}
