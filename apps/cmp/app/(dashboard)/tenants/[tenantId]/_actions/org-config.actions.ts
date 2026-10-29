"use server";

import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { DASHBOARD_CODES, DEFAULT_DASHBOARD_DIMENSIONS, DEFAULT_ENABLED_TYPES, ORG_UNIT_TYPES } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type OrgConfigState = { error?: string; success?: boolean };

const MAX_DIMENSIONS = 6;
const typeCode = z.enum(ORG_UNIT_TYPES.map((t) => t.code) as [string, ...string[]]);
const dashboardCode = z.enum(DASHBOARD_CODES);

async function requireInternalUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

const refresh = (tenantId: string) => revalidatePath(`/tenants/${tenantId}/org-units`);

// ---------------------------------------------------------------------------
// Habilitar / deshabilitar un tipo de unidad organizativa para el tenant
// ---------------------------------------------------------------------------

const enabledSchema = z.object({
  tenantId: z.string().uuid(),
  typeCode,
  enabled: z.boolean(),
});

export async function setOrgUnitTypeEnabledAction(input: z.infer<typeof enabledSchema>): Promise<OrgConfigState> {
  if (!(await requireInternalUser())) return { error: "No autenticado" };
  const parsed = enabledSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const { tenantId, typeCode: code, enabled } = parsed.data;

  try {
    const result = await withTenantContext(tenantId, async (tx) => {
      if (!enabled) {
        const used = await tx.dshDimension.findFirst({ where: { tenantId, orgUnitTypeCode: code } });
        if (used) return "DIMENSION_IN_USE" as const;
      }
      const sortOrder = ORG_UNIT_TYPES.find((t) => t.code === code)!.sortOrder;
      await tx.cfgTenantOrgUnitType.upsert({
        where: { uq_cfg_tenant_org_unit_types: { tenantId, orgUnitTypeCode: code } },
        update: { isEnabled: enabled },
        create: { tenantId, orgUnitTypeCode: code, isEnabled: enabled, sortOrder },
      });
      return "OK" as const;
    });
    if (result === "DIMENSION_IN_USE") {
      return { error: "Este tipo es una dimensión de un dashboard. Quitalo de las dimensiones antes de deshabilitarlo." };
    }
    refresh(tenantId);
    return { success: true };
  } catch (err) {
    console.error("[setOrgUnitTypeEnabledAction]", err);
    return { error: "Error al actualizar. Intentá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Dimensiones de un dashboard (lista ordenada de tipos habilitados)
// ---------------------------------------------------------------------------

const dimensionsSchema = z.object({
  tenantId: z.string().uuid(),
  dashboardCode,
  typeCodes: z.array(typeCode).min(1, "Elegí al menos una dimensión").max(MAX_DIMENSIONS, `Máximo ${MAX_DIMENSIONS} dimensiones`),
});

export async function setDashboardDimensionsAction(input: z.infer<typeof dimensionsSchema>): Promise<OrgConfigState> {
  if (!(await requireInternalUser())) return { error: "No autenticado" };
  const parsed = dimensionsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { tenantId, dashboardCode: dashboard, typeCodes } = parsed.data;
  if (new Set(typeCodes).size !== typeCodes.length) return { error: "Hay dimensiones repetidas" };

  try {
    const result = await withTenantContext(tenantId, async (tx) => {
      const enabled = await tx.cfgTenantOrgUnitType.findMany({
        where: { tenantId, isEnabled: true },
        select: { orgUnitTypeCode: true },
      });
      const enabledSet = new Set(enabled.map((e) => e.orgUnitTypeCode));
      if (typeCodes.some((c) => !enabledSet.has(c))) return "NOT_ENABLED" as const;

      await tx.dshDimension.deleteMany({ where: { tenantId, dashboardCode: dashboard } });
      await tx.dshDimension.createMany({
        data: typeCodes.map((c, i) => ({ tenantId, dashboardCode: dashboard, orgUnitTypeCode: c, sortOrder: i + 1 })),
      });
      return "OK" as const;
    });
    if (result === "NOT_ENABLED") return { error: "Solo se pueden usar tipos habilitados para el tenant." };
    refresh(tenantId);
    return { success: true };
  } catch (err) {
    console.error("[setDashboardDimensionsAction]", err);
    return { error: "Error al actualizar. Intentá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Restaurar valores por defecto
// ---------------------------------------------------------------------------

const resetSchema = z.object({ tenantId: z.string().uuid() });

export async function resetOrgConfigAction(input: z.infer<typeof resetSchema>): Promise<OrgConfigState> {
  if (!(await requireInternalUser())) return { error: "No autenticado" };
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const { tenantId } = parsed.data;

  try {
    await withTenantContext(tenantId, async (tx) => {
      for (const t of ORG_UNIT_TYPES) {
        const enabled = (DEFAULT_ENABLED_TYPES as readonly string[]).includes(t.code);
        await tx.cfgTenantOrgUnitType.upsert({
          where: { uq_cfg_tenant_org_unit_types: { tenantId, orgUnitTypeCode: t.code } },
          update: { isEnabled: enabled, sortOrder: t.sortOrder },
          create: { tenantId, orgUnitTypeCode: t.code, isEnabled: enabled, sortOrder: t.sortOrder },
        });
      }
      await tx.dshDimension.deleteMany({ where: { tenantId } });
      await tx.dshDimension.createMany({
        data: DASHBOARD_CODES.flatMap((dashboardCode) =>
          DEFAULT_DASHBOARD_DIMENSIONS[dashboardCode].map((c, i) => ({
            tenantId,
            dashboardCode,
            orgUnitTypeCode: c,
            sortOrder: i + 1,
          }))
        ),
      });
    });
    refresh(tenantId);
    return { success: true };
  } catch (err) {
    console.error("[resetOrgConfigAction]", err);
    return { error: "Error al restaurar. Intentá de nuevo." };
  }
}
