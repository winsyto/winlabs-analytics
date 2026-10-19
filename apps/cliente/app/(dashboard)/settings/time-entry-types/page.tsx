import Link from "next/link";
import { auth } from "@/auth";
import { withTenantContext, canPerform } from "@wla/auth";
import { TIME_ENTRY_CATEGORIES } from "@wla/db";
import { ChevronRight } from "lucide-react";
import { getCurrentUserRole } from "../_lib/role";
import { TimeEntryTypesTable } from "./_components/time-entry-types-table";

export const dynamic = "force-dynamic";

async function load(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const [types, usage] = await Promise.all([
      tx.cfgTenantTimeEntryType.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } }),
      tx.attTimeDailyEntry.groupBy({
        by: ["timeEntryTypeId"],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);
    const entries = new Map(usage.map((u) => [u.timeEntryTypeId, u._count._all]));
    return types
      .map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        category: t.category,
        isClassified: t.isClassified,
        entries: entries.get(t.id) ?? 0,
        sortOrder: t.sortOrder,
      }))
      .sort((a, b) => Number(a.isClassified) - Number(b.isClassified) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"));
  });
}

export default async function TimeEntryTypesSettingsPage() {
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
        <span className="text-foreground">Tipos de hora</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Tipos de hora</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          La categoría define cómo se usa cada tipo en los dashboards: los de categoría «Hora extra» forman la tasa de
          horas extras y los de «Hora extra no autorizada» se muestran aparte, sin entrar en la tasa.
          {!canEdit && <span className="ml-2 text-xs">(solo lectura — necesitás rol admin para editar)</span>}
        </p>
      </div>

      {pending > 0 && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {pending === 1 ? "Hay 1 tipo de hora sin clasificar" : `Hay ${pending} tipos de hora sin clasificar`}. Mientras
          tanto no cuentan como horas extra. Revisalos y guardá su categoría.
        </p>
      )}

      <TimeEntryTypesTable
        rows={rows}
        categories={TIME_ENTRY_CATEGORIES.map((c) => ({ code: c.code, name: c.name }))}
        canEdit={canEdit}
      />
    </div>
  );
}
