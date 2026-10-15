"use server";

import { auth } from "@/auth";
import { withTenantContext, assertCan } from "@wla/auth";
import { METRIC_CODES, METRIC_TARGET_DEFAULTS } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserRole } from "../../_lib/role";

export type TargetState = { error?: string; success?: boolean };

const metricCode = z.enum(METRIC_CODES as [string, ...string[]]);

async function authorize(): Promise<{ tenantId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.tenantId) return { error: "No autenticado" };
  const tenantId = session.user.tenantId;
  const role = await getCurrentUserRole(tenantId, session.user.id);
  try {
    assertCan(role, "edit", "settings");
  } catch {
    return { error: "No tenés permisos para editar la configuración" };
  }
  return { tenantId };
}

const saveSchema = z.object({
  metricCode,
  targetValue: z
    .number()
    .min(0, "La meta debe estar entre 0 y 100")
    .max(100, "La meta debe estar entre 0 y 100")
    .transform((v) => Math.round(v * 100) / 100),
});

export async function saveTargetAction(input: z.input<typeof saveSchema>): Promise<TargetState> {
  const authz = await authorize();
  if ("error" in authz) return authz;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { metricCode: code, targetValue } = parsed.data;
  const unit = METRIC_TARGET_DEFAULTS[code as keyof typeof METRIC_TARGET_DEFAULTS].unit;
  const { tenantId } = authz;

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.cfgTenantMetricTarget.upsert({
        where: { uq_cfg_tenant_metric_targets: { tenantId, metricCode: code } },
        update: { targetValue },
        create: { tenantId, metricCode: code, targetValue, unit },
      })
    );
    revalidatePath("/settings/targets");
    return { success: true };
  } catch (err) {
    console.error("[saveTargetAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}

const resetSchema = z.object({ metricCode });

/** Quita la meta propia: el dashboard vuelve a usar el valor por defecto. */
export async function resetTargetAction(input: z.infer<typeof resetSchema>): Promise<TargetState> {
  const authz = await authorize();
  if ("error" in authz) return authz;
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const { tenantId } = authz;

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.cfgTenantMetricTarget.deleteMany({ where: { tenantId, metricCode: parsed.data.metricCode } })
    );
    revalidatePath("/settings/targets");
    return { success: true };
  } catch (err) {
    console.error("[resetTargetAction]", err);
    return { error: "Error al restablecer. Intentá de nuevo." };
  }
}
