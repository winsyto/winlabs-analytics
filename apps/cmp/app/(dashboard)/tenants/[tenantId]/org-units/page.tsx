import { notFound } from "next/navigation";
import { prisma } from "@wla/db/client";
import { TenantOrgConfigCard } from "../_components/tenant-org-config-card";
import { TenantSectionHeader } from "../_components/tenant-section-header";
import { getEnabledDashboards, getOrgConfig } from "../_data/tenant-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unidades organizativas del tenant" };

export default async function TenantOrgUnitsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) notFound();

  const enabledDashboards = await getEnabledDashboards(tenantId);
  const orgConfig = await getOrgConfig(tenantId, enabledDashboards);

  return (
    <div className="space-y-4 p-8">
      <TenantSectionHeader
        tenant={tenant}
        section="org-units"
        title="Unidades organizativas y dimensiones"
        description="qué unidades tiene el tenant y por cuáles se abre cada dashboard"
      />
      <TenantOrgConfigCard tenantId={tenant.id} types={orgConfig.types} dashboards={orgConfig.dashboards} />
    </div>
  );
}
