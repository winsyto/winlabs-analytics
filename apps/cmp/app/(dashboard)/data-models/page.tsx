import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";
import { DataModelsTable } from "./_components/data-models-table";

export const dynamic = "force-dynamic";

const MODULES = [
  { key: "people",  label: "Personas",           description: "hr_people, hr_org_units, historial" },
  { key: "time",    label: "Asistencia",          description: "att_time_daily, att_absenteeism_events" },
  { key: "payroll", label: "Liquidaciones",       description: "pay_periods, pay_entries, pay_concepts" },
] as const;

export type DataModule = typeof MODULES[number];

async function getTenants() {
  return prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      activeModules: true,
    },
  });
}

export default async function DataModelsPage() {
  const tenants = await getTenants();

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Modelos de datos"
        description="Activá los módulos analíticos disponibles para cada tenant"
      />
      <DataModelsTable tenants={tenants} modules={MODULES} />
    </div>
  );
}
