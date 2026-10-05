import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { withTenantContext } from "@wla/auth";
import { PageHeader } from "@wla/ui";
import Link from "next/link";
import { FileSpreadsheet, ChevronRight } from "lucide-react";
import { Badge } from "@wla/ui";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const tenantId = session.user.tenantId;

  const integrations = await withTenantContext(tenantId, (tx) =>
    tx.intTenantIntegration.findMany({
      where: {
        tenantId,
        isActive: true,
        template: { category: "file" },
      },
      select: {
        id: true,
        name: true,
        integrationTemplateCode: true,
        status: true,
        lastRunAt: true,
        lastSuccessAt: true,
        template: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    })
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Integraciones"
        title="Carga de archivos"
        description="Subí archivos de tu sistema de RRHH para actualizar los datos analíticos."
      />

      {integrations.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay integraciones de archivo configuradas para tu organización.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Contactá a WinLabs para activar integraciones.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {integrations.map((integration) => (
            <Link
              key={integration.id}
              href={`/integrations/${integration.id}`}
              className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">{integration.template.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={integration.status === "active" ? "default" : "secondary"}>
                  {integration.status === "active" ? "Activo" : integration.status}
                </Badge>
                {integration.lastSuccessAt && (
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Último éxito:{" "}
                    {new Date(integration.lastSuccessAt).toLocaleDateString("es-AR")}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
