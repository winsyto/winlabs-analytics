import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { withTenantContext } from "@wla/auth";
import { PageHeader, Badge } from "@wla/ui";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { FileUpload } from "../_components/file-upload";
import { JobsTable } from "../_components/jobs-table";

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
      <JobsTable jobs={recentJobs} />
    </div>
  );
}
