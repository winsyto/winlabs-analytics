import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";

export interface IntegrationRow {
  id: number;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  name: string;
  templateCode: string;
  templateName: string;
  templateCategory: string;
  status: string;
  createdAt: Date;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
}

/** Catálogo para el alta de integraciones: templates activos */
export async function loadActiveTemplates() {
  return prisma.intTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { code: true, name: true, category: true, targetModel: true },
  });
}

/**
 * Integraciones activas de los tenants indicados (las tablas de integraciones tienen RLS: se lee en el contexto
 * de cada tenant), de la más nueva a la más antigua.
 */
export async function loadIntegrations(tenants: { id: string; name: string; slug: string }[]): Promise<IntegrationRow[]> {
  const perTenant = await Promise.all(
    tenants.map(async (tenant) => {
      const rows = await withTenantContext(tenant.id, (tx) =>
        tx.intTenantIntegration.findMany({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            tenantId: true,
            name: true,
            status: true,
            createdAt: true,
            lastRunAt: true,
            lastSuccessAt: true,
            template: { select: { code: true, name: true, category: true } },
          },
        })
      );
      return rows.map(
        (r): IntegrationRow => ({
          id: r.id,
          tenantId: r.tenantId,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          name: r.name,
          templateCode: r.template.code,
          templateName: r.template.name,
          templateCategory: r.template.category,
          status: r.status,
          createdAt: r.createdAt,
          lastRunAt: r.lastRunAt,
          lastSuccessAt: r.lastSuccessAt,
        })
      );
    })
  );
  return perTenant.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
