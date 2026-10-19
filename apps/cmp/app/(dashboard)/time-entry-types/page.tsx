import { prisma } from "@wla/db/client";
import { TIME_ENTRY_CATEGORIES } from "@wla/db";
import { PageHeader } from "@wla/ui";
import { TimeEntryTypesTable } from "./_components/time-entry-types-table";

export const dynamic = "force-dynamic";

export default async function TimeEntryTypesPage() {
  const rows = await prisma.cfgTimeEntryType.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Tipos de hora por defecto"
        description="Catálogo global que reciben los tenants nuevos. Cada tenant puede ajustar luego la categoría de sus propios tipos desde el portal del cliente. Los cambios acá no modifican a los tenants existentes."
      />
      <TimeEntryTypesTable
        categories={TIME_ENTRY_CATEGORIES.map((c) => ({ code: c.code, name: c.name }))}
        rows={rows.map((r) => ({
          code: r.code,
          name: r.name,
          category: r.category,
          isActive: r.isActive,
        }))}
      />
    </div>
  );
}
