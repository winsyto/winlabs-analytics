import Link from "next/link";
import { auth } from "@/auth";
import { withTenantContext, canPerform } from "@wla/auth";
import { TENANT_SETTINGS_DEFAULTS } from "@wla/db";
import { ChevronRight } from "lucide-react";
import { getCurrentUserRole } from "../_lib/role";
import { ShiftsTable, type ShiftRow } from "./_components/shifts-table";

export const dynamic = "force-dynamic";

async function load(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const [units, settings, typeConfig, assigned] = await Promise.all([
      tx.hrOrgUnit.findMany({
        where: { tenantId, orgUnitTypeCode: "SHIFT", deletedAt: null },
        include: { shiftSchedule: true },
        orderBy: { name: "asc" },
      }),
      tx.cfgTenantSetting.findUnique({ where: { tenantId } }),
      tx.cfgTenantOrgUnitType.findFirst({ where: { tenantId, orgUnitTypeCode: "SHIFT" } }),
      tx.hrPeopleOrgAssignment.groupBy({
        by: ["orgUnitId"],
        where: { tenantId, orgUnitTypeCode: "SHIFT", validTo: null },
        _count: { _all: true },
      }),
    ]);
    const people = new Map(assigned.map((a) => [a.orgUnitId, a._count._all]));
    const defaults = {
      workWeek: settings?.defaultWorkWeek ?? TENANT_SETTINGS_DEFAULTS.defaultWorkWeek,
      dailyHours: Number(settings?.defaultDailyHours ?? TENANT_SETTINGS_DEFAULTS.defaultDailyHours),
    };
    const rows: ShiftRow[] = units.map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
      people: people.get(u.id) ?? 0,
      schedule: u.shiftSchedule
        ? {
            dailyHours: Number(u.shiftSchedule.dailyHours),
            weeklyHours: u.shiftSchedule.weeklyHours === null ? null : Number(u.shiftSchedule.weeklyHours),
            monthlyHours: u.shiftSchedule.monthlyHours === null ? null : Number(u.shiftSchedule.monthlyHours),
            workWeek: u.shiftSchedule.workWeek,
          }
        : null,
    }));
    return { rows, defaults, enabled: typeConfig?.isEnabled ?? false };
  });
}

export default async function ShiftsSettingsPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const role = await getCurrentUserRole(tenantId, session!.user.id);
  const canEdit = canPerform(role, "edit", "settings");
  const { rows, defaults, enabled } = await load(tenantId);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground transition-colors">
          Configuración
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-foreground">Turnos</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Turnos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Las horas diarias y la semana laboral de cada turno definen cuántas horas representa un día de ausencia y el
          total de horas programadas. Un turno sin horario propio usa el de la empresa.
          {!canEdit && <span className="ml-2 text-xs">(solo lectura — necesitás rol admin para editar)</span>}
        </p>
      </div>

      {!enabled ? (
        <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
          La empresa no tiene habilitado el tipo de unidad Turno. Pedí que lo habiliten para poder administrar
          horarios.
        </p>
      ) : (
        <ShiftsTable rows={rows} defaults={defaults} canEdit={canEdit} />
      )}
    </div>
  );
}
