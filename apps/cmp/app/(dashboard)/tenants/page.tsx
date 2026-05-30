import { prisma } from "@wla/db/client";
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} registrado
            {tenants.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateTenantDialog />
      </div>

      {/* Tabla */}
      <TenantsTable tenants={tenants} />
    </div>
  );
}
