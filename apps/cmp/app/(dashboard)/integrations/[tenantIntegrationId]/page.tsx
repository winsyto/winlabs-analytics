import { notFound } from "next/navigation";
import { withTenantContext } from "@wla/auth";
import { prisma } from "@wla/db/client";
import { IntegrationDetail } from "./_components/integration-detail";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ tenantIntegrationId: string }>;
  searchParams: Promise<{ tenantId?: string }>;
}

export default async function IntegrationDetailPage({ params, searchParams }: Props) {
  const { tenantIntegrationId } = await params;
  const { tenantId } = await searchParams;

  const id = parseInt(tenantIntegrationId, 10);
  if (isNaN(id) || !tenantId) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  if (!tenant) notFound();

  const [integration, runs, jobs] = await Promise.all([
    withTenantContext(tenantId, (tx) =>
      tx.intTenantIntegration.findUnique({
        where: { id },
        select: {
          id: true,
          tenantId: true,
          name: true,
          status: true,
          scheduleCron: true,
          lastRunAt: true,
          lastSuccessAt: true,
          createdAt: true,
          template: { select: { name: true, category: true } },
        },
      })
    ),
    withTenantContext(tenantId, (tx) =>
      tx.intRun.findMany({
        where: { tenantIntegrationId: id },
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          triggerSource: true,
          startedAt: true,
          finishedAt: true,
          rowsRead: true,
          rowsLoaded: true,
          rowsError: true,
          rowsWarning: true,
          errorMessage: true,
        },
      })
    ),
    withTenantContext(tenantId, (tx) =>
      tx.job.findMany({
        where: { tenantId, integrationId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          createdAt: true,
          finishedAt: true,
          result: true,
          lastError: true,
        },
      })
    ),
  ]);

  if (!integration) notFound();

  return (
    <div className="p-8">
      <IntegrationDetail
        integration={{
          ...integration,
          tenantName: tenant.name,
          templateName: integration.template.name,
          templateCategory: integration.template.category,
        }}
        runs={runs}
        jobs={jobs}
      />
    </div>
  );
}
