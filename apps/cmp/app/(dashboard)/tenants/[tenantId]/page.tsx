import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { Badge } from "@wla/ui";
import { TenantModulesCard } from "./_components/tenant-modules-card";
import { TenantActionsHeader } from "./_components/tenant-actions-header";
import { TenantInfoCard } from "./_components/tenant-info-card";
import { TenantDashboardsCard } from "./_components/tenant-dashboards-card";
import { TENANT_SECTION_LIST } from "./_components/tenant-section-header";
import { getEnabledDashboards } from "./_data/tenant-config";
import { Breadcrumb } from "../../_components/breadcrumb";

export const dynamic = "force-dynamic";

const MODULES = [
  { key: "people",  label: "Personas",      description: "hr_people, hr_org_units, historial" },
  { key: "time",    label: "Asistencia",    description: "att_time_daily, att_absenteeism_events" },
  { key: "payroll", label: "Liquidaciones", description: "pay_periods, pay_processes, pay_entries, pay_concepts" },
] as const;

export type DataModule = typeof MODULES[number];

async function getTenant(tenantId: string) {
  const [tenant, userCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        activeModules: true,
        createdAt: true,
      },
    }),
    withTenantContext(tenantId, (tx) => tx.user.count({ where: { tenantId } })),
  ]);
  if (!tenant) return null;
  return { ...tenant, userCount };
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const enabledDashboards = await getEnabledDashboards(tenantId);
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  return (
    <div className="p-8 space-y-6">
      <Breadcrumb items={[{ label: "Tenants", href: "/tenants" }, { label: "Tenants", href: "/tenants/list" }, { label: tenant.name }]} />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-medium text-foreground">{tenant.name}</h1>
            <Badge variant={tenant.isActive ? "default" : "secondary"}>
              {tenant.isActive ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">{tenant.slug}</p>
        </div>
        <TenantActionsHeader tenant={{ id: tenant.id, slug: tenant.slug, isActive: tenant.isActive }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TenantInfoCard
          tenant={{
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            createdAt: tenant.createdAt,
            userCount: tenant.userCount,
          }}
        />
        <TenantModulesCard
          tenant={{ id: tenant.id, name: tenant.name, activeModules: tenant.activeModules }}
          modules={MODULES}
        />
      </div>

      <TenantDashboardsCard
        tenantId={tenant.id}
        tenantName={tenant.name}
        activeModules={tenant.activeModules}
        enabled={enabledDashboards}
      />

      <nav aria-label="Secciones del tenant" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Otras secciones:</span>
        {TENANT_SECTION_LIST.filter((x) => x.key !== "info").map((x) => (
          <Link key={x.key} href={`/tenants/${tenant.id}${x.path}`} className="rounded-full border bg-card px-3 py-1 text-foreground hover:bg-muted">
            {x.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
