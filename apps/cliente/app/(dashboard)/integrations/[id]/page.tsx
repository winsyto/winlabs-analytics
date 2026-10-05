import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { withTenantContext } from "@wla/auth";
import { PageHeader, Badge } from "@wla/ui";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { FileUpload } from "../_components/file-upload";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IntegrationDetailPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");
  const tenantId = session.user.tenantId;
  const { id } = await params;
  const integrationId = Number(id);
  if (!integrationId) notFound();

  const integration = await withTenantContext(tenantId, (tx) =>
    tx.intTenantIntegration.findFirst({
      where: { id: integrationId, tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        integrationTemplateCode: true,
        status: true,
        lastRunAt: true,
        lastSuccessAt: true,
        template: { select: { name: true } },
      },
    })
  );
  if (!integration) notFound();

  // Últimos 10 jobs de esta integración
  const recentJobs = await withTenantContext(tenantId, (tx) =>
    tx.job.findMany({
      where: { tenantId, integrationId: integrationId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        finishedAt: true,
        result: true,
        lastError: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a integraciones
        </Link>
        <PageHeader
          eyebrow={integration.template.name}
          title={integration.name}
          description="Subí un archivo para iniciar el procesamiento de datos."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload */}
        <FileUpload
          integrationId={integration.id}
          integrationName={integration.name}
        />

        {/* Info */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="font-medium text-sm">Estado de la integración</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant={integration.status === "active" ? "default" : "secondary"}>
                {integration.status === "active" ? "Activo" : integration.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Último procesamiento</span>
              <span className="text-foreground">
                {integration.lastRunAt
                  ? new Date(integration.lastRunAt).toLocaleString("es-AR")
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Último éxito</span>
              <span className="text-foreground">
                {integration.lastSuccessAt
                  ? new Date(integration.lastSuccessAt).toLocaleString("es-AR")
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de jobs */}
      {recentJobs.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Últimos procesamientos</h3>
          </div>
          <div className="divide-y">
            {recentJobs.map((job) => {
              const result = job.result as Record<string, unknown> | null;
              return (
                <div key={job.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <JobStatusBadge status={job.status} />
                    <div>
                      <p className="text-foreground">Job #{job.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString("es-AR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {result && typeof result.rows_ok === "number" && (
                      <p>{result.rows_ok as number} filas OK · {result.rows_error as number} errores</p>
                    )}
                    {job.lastError && (
                      <p className="text-destructive truncate max-w-[200px]">{job.lastError}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending:          { label: "Pendiente",   variant: "outline" },
    running:          { label: "Procesando",  variant: "secondary" },
    completed:        { label: "Completado",  variant: "default" },
    failed:           { label: "Fallido",     variant: "destructive" },
    retry_scheduled:  { label: "Reintento",   variant: "secondary" },
  };
  const cfg = variants[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
