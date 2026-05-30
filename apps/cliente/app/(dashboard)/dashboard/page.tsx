import { auth } from "@/auth";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";

async function getTenantStats(tenantId: string) {
  const [userCount] = await withTenantContext(tenantId, async (tx) => {
    return Promise.all([
      tx.user.count({ where: { tenantId, isActive: true } }),
    ]);
  });
  return { userCount };
}

export default async function DashboardPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;

  const [tenant, stats] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    }),
    getTenantStats(tenantId),
  ]);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-0.5">
          Bienvenido, {session?.user?.name}. Estás viendo{" "}
          <span className="font-medium text-foreground">{tenant?.name}</span>.
        </p>
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-6 space-y-1">
          <p className="text-sm text-muted-foreground">Usuarios activos</p>
          <p className="text-3xl font-bold text-foreground">{stats.userCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-1">
          <p className="text-sm text-muted-foreground">Reportes</p>
          <p className="text-3xl font-bold text-foreground">—</p>
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-1">
          <p className="text-sm text-muted-foreground">Integraciones</p>
          <p className="text-3xl font-bold text-foreground">—</p>
        </div>
      </div>

      {/* Coming soon */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center">
        <p className="text-muted-foreground text-sm">
          Los reportes y métricas de People Analytics estarán disponibles próximamente.
        </p>
      </div>
    </div>
  );
}
