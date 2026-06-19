import { auth } from "@/auth";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { EmptyState, KpiCard } from "@wla/ui";
import { Sparkles } from "lucide-react";

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Usuarios activos" value={stats.userCount} />
        <KpiCard label="Reportes" value="—" />
        <KpiCard label="Integraciones" value="—" />
      </div>

      {/* Coming soon */}
      <EmptyState
        icon={Sparkles}
        text="Los reportes y métricas de People Analytics estarán disponibles próximamente."
      />
    </div>
  );
}
