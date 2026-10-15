import Link from "next/link";
import { auth } from "@/auth";
import { withTenantContext, canPerform } from "@wla/auth";
import { ABSENTEEISM_CLASSES } from "@wla/db";
import { ChevronRight } from "lucide-react";
import { getCurrentUserRole } from "../_lib/role";
import { AbsenceTypesTable } from "./_components/absence-types-table";

export const dynamic = "force-dynamic";

async function load(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const [types, usage] = await Promise.all([
      tx.cfgAbsenteeismType.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      tx.attAbsenteeismEvent.groupBy({
        by: ["absenteeismTypeId"],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);
    const events = new Map(usage.map((u) => [u.absenteeismTypeId, u._count._all]));
    return types
      .map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        class: t.class,
        countsAsAbsence: t.countsAsAbsence,
        isClassified: t.isClassified,
        events: events.get(t.id) ?? 0,
      }))
      .sort((a, b) => Number(a.isClassified) - Number(b.isClassified) || a.name.localeCompare(b.name, "es"));
  });
}

export default async function AbsenceTypesSettingsPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const role = await getCurrentUserRole(tenantId, session!.user.id);
  const canEdit = canPerform(role, "edit", "settings");
  const rows = await load(tenantId);
  const pending = rows.filter((r) => !r.isClassified).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground transition-colors">
          Configuración
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-foreground">Tipos de ausencia</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Tipos de ausencia</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          La clase agrupa los tipos en el dashboard de ausentismo. Un tipo que no cuenta como ausentismo (por ejemplo,
          vacaciones o licencias de ley) queda fuera de la tasa.
          {!canEdit && <span className="ml-2 text-xs">(solo lectura — necesitás rol admin para editar)</span>}
        </p>
      </div>

      {pending > 0 && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {pending === 1 ? "Hay 1 tipo sin clasificar" : `Hay ${pending} tipos sin clasificar`}. Mientras tanto cuentan
          como ausentismo y pueden distorsionar la tasa. Revisalos y guardá su clasificación.
        </p>
      )}

      <AbsenceTypesTable
        rows={rows}
        classes={ABSENTEEISM_CLASSES.map((c) => ({ code: c.code, name: c.name }))}
        canEdit={canEdit}
      />
    </div>
  );
}
