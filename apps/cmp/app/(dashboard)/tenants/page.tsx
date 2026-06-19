import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";
import { TenantsTable } from "./_components/tenants-table";
import { CreateTenantDialog } from "./_components/create-tenant-dialog";

export const dynamic = "force-dynamic";

async function getTenants() {
  return prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Tenants"
        description={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} registrado${tenants.length !== 1 ? "s" : ""}`}
        actions={<CreateTenantDialog />}
      />

      {/* Tabla */}
      <TenantsTable tenants={tenants} />
    </div>
  );
}
