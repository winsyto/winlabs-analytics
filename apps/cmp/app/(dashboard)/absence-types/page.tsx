import { prisma } from "@wla/db/client";
import { ABSENTEEISM_CLASSES } from "@wla/db";
import { PageHeader } from "@wla/ui";
import { AbsenceTypesTable } from "./_components/absence-types-table";

export const dynamic = "force-dynamic";

export default async function AbsenceTypesPage() {
  const rows = await prisma.cfgAbsenteeismTypeDefault.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Tipos de ausencia por defecto"
        description="Catálogo global que reciben los tenants nuevos. Cada tenant puede ajustar luego sus propios tipos desde el portal del cliente. Los cambios acá no modifican a los tenants existentes."
      />
      <AbsenceTypesTable
        classes={ABSENTEEISM_CLASSES.map((c) => ({ code: c.code, name: c.name }))}
        rows={rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          class: r.class,
          countsAsAbsence: r.countsAsAbsence,
          isActive: r.isActive,
        }))}
      />
    </div>
  );
}
