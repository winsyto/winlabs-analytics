import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { PageHeader } from "@wla/ui";
import { IntegrationsTable } from "./_components/integrations-table";
import { NewIntegrationDialog } from "./_components/new-integration-dialog";

export const dynamic = "force-dynamic";

async function getData() {
  const [tenants, templates] = await Promise.all([
    prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.intTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true, category: true, targetModel: true },
    }),
  ]);

  const integrationsByTenant = await Promise.all(
    tenants.map((tenant) =>
      withTenantContext(tenant.id, (tx) =>
        tx.intTenantIntegration.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            tenantId: true,
            name: true,
            status: true,
            lastRunAt: true,
            lastSuccessAt: true,
            template: { select: { name: true, category: true } },
          },
        })
      ).then((rows) =>
        rows.map((r) => ({
          id: r.id,
          tenantId: r.tenantId,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          name: r.name,
          templateName: r.template.name,
          templateCategory: r.template.category,
          status: r.status,
          lastRunAt: r.lastRunAt,
          lastSuccessAt: r.lastSuccessAt,
        }))
      )
    )
  );

  const integrations = integrationsByTenant.flat();

  return { tenants, templates, integrations };
}

export default async function IntegrationsPage() {
  const { tenants, templates, integrations } = await getData();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Integraciones"
          description="Integraciones activas por tenant"
        />
        <NewIntegrationDialog tenants={tenants} templates={templates} />
      </div>
      <IntegrationsTable integrations={integrations} tenants={tenants} />
    </div>
  );
}
