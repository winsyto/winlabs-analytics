import Link from "next/link";
import { auth } from "@/auth";
import { Building2, Plug, Users } from "lucide-react";
import { withTenantContext } from "@wla/auth";
import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inicio" };

const nf = new Intl.NumberFormat("es-AR");

/**
 * Indicadores básicos de la plataforma. Las tablas de tenant tienen RLS, así que usuarios e integraciones se cuentan
 * dentro del contexto de cada tenant activo.
 */
async function loadStats() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, isActive: true } });
  const active = tenants.filter((t) => t.isActive);
  const perTenant = await Promise.all(
    active.map((t) =>
      withTenantContext(t.id, async (tx) => {
        const [users, integrations] = await Promise.all([
          tx.user.count({ where: { tenantId: t.id, isActive: true } }),
          tx.intTenantIntegration.findMany({
            where: { tenantId: t.id, isActive: true, status: "active" },
            select: { template: { select: { category: true } } },
          }),
        ]);
        return {
          users,
          manual: integrations.filter((i) => i.template.category === "file").length,
          automatic: integrations.filter((i) => i.template.category !== "file").length,
        };
      })
    )
  );
  return {
    tenantsTotal: tenants.length,
    tenantsActive: active.length,
    users: perTenant.reduce((s, t) => s + t.users, 0),
    manual: perTenant.reduce((s, t) => s + t.manual, 0),
    automatic: perTenant.reduce((s, t) => s + t.automatic, 0),
  };
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  detail,
}: {
  href: string;
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Link>
  );
}

export default async function HomePage() {
  const session = await auth();
  const s = await loadStats();
  const integrations = s.manual + s.automatic;

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Inicio" description={`Bienvenido, ${session?.user?.name}. Estado general de la plataforma.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/tenants/list"
          icon={Building2}
          label="Tenants activos"
          value={nf.format(s.tenantsActive)}
          detail={`${nf.format(s.tenantsTotal)} en total${s.tenantsTotal > s.tenantsActive ? ` · ${nf.format(s.tenantsTotal - s.tenantsActive)} inactivos` : ""}`}
        />
        <StatCard
          href="/tenants/list"
          icon={Users}
          label="Usuarios de tenants"
          value={nf.format(s.users)}
          detail="Usuarios activos de los tenants activos"
        />
        <StatCard
          href="/integrations/active"
          icon={Plug}
          label="Integraciones activas"
          value={nf.format(integrations)}
          detail={`${nf.format(s.manual)} manuales · ${nf.format(s.automatic)} automáticas`}
        />
      </div>
    </div>
  );
}
