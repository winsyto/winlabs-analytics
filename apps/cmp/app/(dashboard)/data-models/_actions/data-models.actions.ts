"use server";

import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { DASHBOARD_CATALOG, missingModules, type DashboardCode } from "@wla/db";
import { prisma } from "@wla/db/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const VALID_MODULES = ["people", "time", "payroll"] as const;

const updateSchema = z.object({
  tenantId: z.string().uuid(),
  activeModules: z.array(z.enum(VALID_MODULES)),
});

export type UpdateModulesState = { error?: string; success?: boolean };

export async function updateTenantModulesAction(
  _prev: UpdateModulesState,
  formData: FormData
): Promise<UpdateModulesState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };
  const internalUserId = session.user.id;

  const rawModules = formData.getAll("activeModules") as string[];

  const parsed = updateSchema.safeParse({
    tenantId: formData.get("tenantId"),
    activeModules: rawModules,
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  try {
    await prisma.tenant.update({
      where: { id: parsed.data.tenantId },
      data: { activeModules: parsed.data.activeModules },
    });

    // Un dashboard no puede quedar activo sin los módulos de datos que requiere: se apagan los que dejaron de cumplirlo
    const tenantId = parsed.data.tenantId;
    await withTenantContext(tenantId, async (tx) => {
      const enabled = await tx.dshTenantDashboard.findMany({ where: { tenantId, isEnabled: true }, select: { dashboardCode: true } });
      for (const { dashboardCode } of enabled) {
        const code = dashboardCode as DashboardCode;
        if (!DASHBOARD_CATALOG[code] || missingModules(code, parsed.data.activeModules).length === 0) continue;
        await tx.dshTenantDashboard.update({ where: { uq_dsh_tenant_dashboards: { tenantId, dashboardCode } }, data: { isEnabled: false } });
        await tx.auditLog.create({
          data: {
            tenantId,
            action: "dashboard.disabled",
            entityType: "dashboard",
            entityId: dashboardCode,
            metadata: { name: DASHBOARD_CATALOG[code].name, reason: "module_deactivated", internalUserId },
          },
        });
      }
    });
    revalidatePath("/dashboards");
    revalidatePath(`/tenants/${tenantId}`);

    revalidatePath("/tenants");
    return { success: true };
  } catch (err) {
    console.error("[updateTenantModulesAction]", err);
    return { error: "Error al actualizar. Intentá de nuevo." };
  }
}
