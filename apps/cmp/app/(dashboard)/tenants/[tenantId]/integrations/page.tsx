import { notFound } from "next/navigation";
import { prisma } from "@wla/db/client";
import { IntegrationsTable } from "../../../integrations/_components/integrations-table";
import { NewIntegrationDialog } from "../../../integrations/_components/new-integration-dialog";
import { loadActiveTemplates, loadIntegrations } from "../../../integrations/_data/load-integrations";
import { Pager, listHref, paginate } from "../../../_components/list-controls";
import { TenantSectionHeader } from "../_components/tenant-section-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integraciones del tenant" };

export default async function TenantIntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } });
  if (!tenant) notFound();

  const [integrations, templates] = await Promise.all([loadIntegrations([tenant]), loadActiveTemplates()]);
  const { page, pages, skip, take } = paginate(integrations.length, Math.max(1, Number(sp.page) || 1));

  return (
    <div className="space-y-4 p-8">
      <TenantSectionHeader
        tenant={tenant}
        section="integrations"
        title="Integraciones"
        description="integraciones configuradas para el tenant"
        actions={<NewIntegrationDialog tenants={[tenant]} templates={templates} defaultTenantId={tenant.id} />}
      />

      {integrations.length === 0 ? (
        <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Este tenant todavía no tiene integraciones. Creá la primera con «Nueva integración».
        </p>
      ) : (
        <div className="rounded-md border bg-card">
          <IntegrationsTable integrations={integrations.slice(skip, skip + take)} showTenant={false} />
          <Pager
            page={page}
            pages={pages}
            total={integrations.length}
            noun={["integración", "integraciones"]}
            hrefFor={(p) => listHref(`/tenants/${tenant.id}/integrations`, { page: p })}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">La vista de todos los tenants está en Integraciones › Integraciones activas.</p>
    </div>
  );
}
