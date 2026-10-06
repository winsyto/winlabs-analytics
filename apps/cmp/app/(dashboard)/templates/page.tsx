import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";
import { TemplatesTable } from "./_components/templates-table";

export const dynamic = "force-dynamic";

async function getTemplates() {
  return prisma.intTemplate.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      code: true,
      name: true,
      category: true,
      targetModel: true,
      isActive: true,
    },
  });
}

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Templates de integración"
        description="Catálogo global de templates disponibles para los tenants."
      />
      <TemplatesTable templates={templates} />
    </div>
  );
}
