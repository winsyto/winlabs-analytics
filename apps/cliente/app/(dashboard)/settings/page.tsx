import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { CalendarOff, Clock, Network, Receipt, ShieldCheck, Target, Timer, Users, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { HubCard, HubGroup } from "../_components/hub-card";
import { enabledDashboards } from "../_dashboard-kit/dashboard-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

interface Option {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Dashboards que usan esta opción: se muestra si el tenant tiene activo alguno. Sin lista = siempre */
  dashboards?: string[];
  soon?: boolean;
  badge?: string | null;
}

/** Avisos de pendientes de cada opción, según los datos del tenant. */
async function pendings(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const [absence, timeTypes, unclassifiedConcepts, grossMarked, conceptsTotal, shifts] = await Promise.all([
      tx.cfgAbsenteeismType.count({ where: { tenantId, isClassified: false } }),
      tx.cfgTenantTimeEntryType.count({ where: { tenantId, isClassified: false } }),
      tx.payConcept.count({ where: { tenantId, isClassified: false } }),
      tx.payConcept.count({ where: { tenantId, referenceTotal: "gross" } }),
      tx.payConcept.count({ where: { tenantId } }),
      tx.hrOrgUnit.count({ where: { tenantId, orgUnitTypeCode: "SHIFT", deletedAt: null, isActive: true, shiftSchedule: { is: null } } }),
    ]);
    return {
      absence: absence > 0 ? `${absence} sin clasificar` : null,
      timeTypes: timeTypes > 0 ? `${timeTypes} sin clasificar` : null,
      concepts: unclassifiedConcepts > 0 ? `${unclassifiedConcepts} sin clasificar` : conceptsTotal > 0 && grossMarked === 0 ? "Falta el total bruto" : null,
      shifts: shifts > 0 ? `${shifts} ${shifts === 1 ? "turno sin horario" : "turnos sin horario"}` : null,
    };
  });
}

export default async function SettingsHubPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const [enabled, p] = await Promise.all([enabledDashboards(tenantId), pendings(tenantId)]);

  const groups: { title: string; icon: LucideIcon; options: Option[] }[] = [
    {
      title: "Seguridad",
      icon: ShieldCheck,
      options: [{ href: "/settings/users", title: "Usuarios", description: "Usuarios de la empresa, sus roles y su estado.", icon: Users }],
    },
    {
      title: "Básicas",
      icon: Settings2,
      options: [
        { href: "/settings/org-units", title: "Unidades organizativas", description: "Empresas, sucursales, áreas, puestos y demás unidades.", icon: Network, soon: true },
        { href: "/settings/shifts", title: "Turnos", description: "Horas diarias y semana laboral de cada turno.", icon: Clock, dashboards: ["absenteeism", "overtime"], badge: p.shifts },
        { href: "/settings/absence-types", title: "Tipos de ausencia", description: "Clase de cada tipo y si cuenta como ausentismo.", icon: CalendarOff, dashboards: ["absenteeism"], badge: p.absence },
        { href: "/settings/time-entry-types", title: "Tipos de hora", description: "Categoría de cada tipo: horas extra, no autorizadas, etc.", icon: Timer, dashboards: ["overtime"], badge: p.timeTypes },
        { href: "/settings/payroll-concepts", title: "Conceptos de liquidación", description: "Tipo y clase de cada concepto, total bruto y neto.", icon: Receipt, dashboards: ["payroll"], badge: p.concepts },
        { href: "/settings/targets", title: "Metas", description: "Valores de referencia que los dashboards muestran como meta.", icon: Target, dashboards: ["absenteeism", "overtime", "turnover"] },
      ],
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader eyebrow="Configuración" title="Configuración" description="Ajustes de la empresa que usan los dashboards. Solo se muestran las opciones que aplican a tus dashboards." />
      {groups.map((g) => {
        const visible = g.options.filter((o) => !o.dashboards || o.dashboards.some((d) => enabled.includes(d)));
        if (visible.length === 0) return null;
        return (
          <HubGroup key={g.title} title={g.title}>
            {visible.map((o) => (
              <HubCard key={o.href} href={o.href} icon={o.icon} title={o.title} description={o.description} badge={o.badge} soon={o.soon} />
            ))}
          </HubGroup>
        );
      })}
    </div>
  );
}
