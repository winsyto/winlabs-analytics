import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { Badge } from "@wla/ui";
import { ChevronRight, Users } from "lucide-react";
import { TenantModulesCard } from "./_components/tenant-modules-card";
import { TenantActionsHeader } from "./_components/tenant-actions-header";
import { TenantInfoCard } from "./_components/tenant-info-card";
import { TenantOrgConfigCard } from "./_components/tenant-org-config-card";
import { TenantAttendanceCard, type AttendanceSettings } from "./_components/tenant-attendance-card";
import { TENANT_SETTINGS_DEFAULTS } from "@wla/db";

export const dynamic = "force-dynamic";

const MODULES = [
  { key: "people",  label: "Personas",      description: "hr_people, hr_org_units, historial" },
  { key: "time",    label: "Asistencia",    description: "att_time_daily, att_absenteeism_events" },
  { key: "payroll", label: "Liquidaciones", description: "pay_periods, pay_entries, pay_concepts" },
] as const;

const DASHBOARDS = [
  { code: "headcount", label: "Headcount" },
  { code: "absenteeism", label: "Ausentismos" },
  { code: "overtime", label: "Horas extras" },
] as const;

export type DataModule = typeof MODULES[number];

async function getOrgConfig(tenantId: string) {
  const [allTypes, tenantTypes, dims] = await withTenantContext(tenantId, (tx) =>
    Promise.all([
      tx.cfgOrgUnitType.findMany({ orderBy: { sortOrder: "asc" } }),
      tx.cfgTenantOrgUnitType.findMany({ where: { tenantId } }),
      tx.dshDimension.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } }),
    ])
  );
  const enabled = new Map(tenantTypes.map((t) => [t.orgUnitTypeCode, t.isEnabled]));
  return {
    types: allTypes.map((t) => ({
      code: t.code,
      name: t.name,
      description: t.description,
      enabled: enabled.get(t.code) ?? false,
    })),
    dashboards: DASHBOARDS.map((d) => ({
      ...d,
      dimensions: dims.filter((x) => x.dashboardCode === d.code).map((x) => x.orgUnitTypeCode),
    })),
  };
}

async function getAttendanceSettings(tenantId: string): Promise<AttendanceSettings> {
  const row = await withTenantContext(tenantId, (tx) => tx.cfgTenantSetting.findUnique({ where: { tenantId } }));
  if (!row) return { ...TENANT_SETTINGS_DEFAULTS };
  return {
    attendanceMode: row.attendanceMode as AttendanceSettings["attendanceMode"],
    defaultWorkWeek: row.defaultWorkWeek,
    defaultDailyHours: Number(row.defaultDailyHours),
    absenceDisplay: row.absenceDisplay as AttendanceSettings["absenceDisplay"],
    overtimeBase: row.overtimeBase as AttendanceSettings["overtimeBase"],
  };
}

async function getTenant(tenantId: string) {
  const [tenant, userCount, integrationCount] = await Promise.all([
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
    withTenantContext(tenantId, (tx) => tx.intTenantIntegration.count({ where: { tenantId, isActive: true } })),
  ]);
  if (!tenant) return null;
  return { ...tenant, userCount, integrationCount };
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [tenant, orgConfig, attendance] = await Promise.all([
    getTenant(tenantId),
    getOrgConfig(tenantId),
    getAttendanceSettings(tenantId),
  ]);
  if (!tenant) notFound();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/tenants" className="hover:text-foreground transition-colors">
          Tenants
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{tenant.name}</span>
      </div>

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

      <div className="grid grid-cols-2 gap-6">
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

      <TenantOrgConfigCard
        tenantId={tenant.id}
        types={orgConfig.types}
        dashboards={orgConfig.dashboards}
      />

      <TenantAttendanceCard tenantId={tenant.id} settings={attendance} />

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Usuarios del tenant
          </h3>
          <Link
            href={`/tenants/${tenantId}/users`}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Users className="h-3.5 w-3.5" />
            Gestionar usuarios
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {tenant.userCount === 0
            ? "Sin usuarios creados."
            : `${tenant.userCount} usuario${tenant.userCount !== 1 ? "s" : ""} registrado${tenant.userCount !== 1 ? "s" : ""}.`}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Integraciones activas
        </h3>
        {tenant.integrationCount === 0 ? (
          <p className="text-sm text-muted-foreground">Sin integraciones activas.</p>
        ) : (
          <p className="text-sm text-foreground">
            {tenant.integrationCount} integración{tenant.integrationCount !== 1 ? "es" : ""} activa{tenant.integrationCount !== 1 ? "s" : ""}.
          </p>
        )}
        <Link
          href="/integrations"
          className="text-xs text-primary hover:underline mt-2 inline-block"
        >
          Gestionar en Integraciones →
        </Link>
      </div>
    </div>
  );
}
