"use server";

import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { DASHBOARD_CATALOG, DASHBOARD_CODES, DATA_MODULES, missingModules } from "@wla/db";
import { prisma } from "@wla/db/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type TenantDashboardState = { error?: string; success?: boolean };

const schema = z.object({
  tenantId: z.string().uuid(),
  dashboardCode: z.enum(DASHBOARD_CODES),
  enabled: z.boolean(),
});

/**
 * Activa o desactiva un dashboard para un tenant. Activar exige que estén activos los módulos de datos que el
 * dashboard requiere. Cada cambio queda en audit_log.
 */
export async function setTenantDashboardAction(input: z.infer<typeof schema>): Promise<TenantDashboardState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };
  const internalUserId = session.user.id;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const { tenantId, dashboardCode, enabled } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { activeModules: true } });
  if (!tenant) return { error: "El tenant no existe" };

  if (enabled) {
    const missing = missingModules(dashboardCode, tenant.activeModules);
    if (missing.length > 0) {
      const names = missing.map((m) => DATA_MODULES.find((d) => d.code === m)?.name ?? m).join(", ");
      return { error: `Falta activar el módulo de datos: ${names}` };
    }
  }

  try {
    await withTenantContext(tenantId, async (tx) => {
      await tx.dshTenantDashboard.upsert({
        where: { uq_dsh_tenant_dashboards: { tenantId, dashboardCode } },
        update: { isEnabled: enabled },
        create: { tenantId, dashboardCode, isEnabled: enabled },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          action: enabled ? "dashboard.enabled" : "dashboard.disabled",
          entityType: "dashboard",
          entityId: dashboardCode,
          metadata: { name: DASHBOARD_CATALOG[dashboardCode].name, internalUserId },
        },
      });
    });
    revalidatePath("/settings/dashboards");
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (err) {
    console.error("[setTenantDashboardAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}
