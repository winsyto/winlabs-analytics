import Link from "next/link";
import { auth } from "@/auth";
import { withTenantContext, canPerform } from "@wla/auth";
import { METRIC_TARGET_DEFAULTS } from "@wla/db";
import { ChevronRight } from "lucide-react";
import { getCurrentUserRole } from "../_lib/role";
import { TargetsForm } from "./_components/targets-form";

export const dynamic = "force-dynamic";

/** Metas que ya tienen un dashboard que las usa. Se suman a medida que se construyen. */
const AVAILABLE = [
  {
    code: "absenteeism_rate",
    label: "Tasa de ausentismo",
    description: "Horas de ausencia sobre horas programadas, por mes. Se muestra como línea de referencia en el dashboard de Ausentismos.",
  },
  {
    code: "overtime_rate",
    label: "Tasa de horas extras",
    description: "Horas extra sobre horas programadas, por mes. Se muestra como línea de referencia en el dashboard de Horas extras.",
  },
] as const;

export default async function TargetsSettingsPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const role = await getCurrentUserRole(tenantId, session!.user.id);
  const canEdit = canPerform(role, "edit", "settings");
  const saved = await withTenantContext(tenantId, (tx) => tx.cfgTenantMetricTarget.findMany({ where: { tenantId } }));
  const byCode = new Map(saved.map((s) => [s.metricCode, Number(s.targetValue)]));

  const rows = AVAILABLE.map((m) => {
    const def = METRIC_TARGET_DEFAULTS[m.code];
    return {
      code: m.code,
      label: m.label,
      description: m.description,
      unitLabel: def.unit === "percent_monthly" ? "% mensual" : "% anual",
      defaultValue: def.value,
      value: byCode.get(m.code) ?? null,
    };
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground transition-colors">
          Configuración
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-foreground">Metas</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Metas</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Valores de referencia que los dashboards muestran como meta. Sin una meta propia se usa el valor por defecto.
          {!canEdit && <span className="ml-2 text-xs">(solo lectura — necesitás rol admin para editar)</span>}
        </p>
      </div>

      <TargetsForm rows={rows} canEdit={canEdit} />
    </div>
  );
}
