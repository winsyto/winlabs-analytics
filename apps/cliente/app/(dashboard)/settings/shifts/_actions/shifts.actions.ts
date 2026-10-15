"use server";

import { auth } from "@/auth";
import { withTenantContext, assertCan } from "@wla/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserRole } from "../../_lib/role";

export type ShiftState = { error?: string; success?: boolean };

const scheduleSchema = z.object({
  orgUnitId: z.number().int().positive(),
  dailyHours: z.number().gt(0, "Las horas diarias deben ser mayores a 0").max(24, "Máximo 24 horas por día"),
  weeklyHours: z.number().gt(0, "Las horas semanales deben ser mayores a 0").max(168, "Máximo 168 horas por semana").nullable(),
  monthlyHours: z.number().gt(0, "Las horas mensuales deben ser mayores a 0").max(744, "Máximo 744 horas por mes").nullable(),
  workWeek: z
    .string()
    .regex(/^[01]{7}$/, "La semana laboral debe tener 7 días")
    .refine((w) => w.includes("1"), "La semana laboral debe tener al menos un día laborable"),
});

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

export async function saveShiftScheduleAction(input: z.infer<typeof scheduleSchema>): Promise<ShiftState> {
  const authz = await authorize();
  if ("error" in authz) return authz;
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { orgUnitId, ...data } = parsed.data;
  const { tenantId } = authz;

  try {
    const result = await withTenantContext(tenantId, async (tx) => {
      const unit = await tx.hrOrgUnit.findFirst({
        where: { id: orgUnitId, tenantId, orgUnitTypeCode: "SHIFT", deletedAt: null },
        select: { id: true },
      });
      if (!unit) return "NOT_FOUND" as const;
      await tx.hrShiftSchedule.upsert({
        where: { orgUnitId },
        update: data,
        create: { tenantId, orgUnitId, orgUnitTypeCode: "SHIFT", ...data },
      });
      return "OK" as const;
    });
    if (result === "NOT_FOUND") return { error: "El turno no existe" };
    revalidatePath("/settings/shifts");
    return { success: true };
  } catch (err) {
    console.error("[saveShiftScheduleAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}

const resetSchema = z.object({ orgUnitId: z.number().int().positive() });

/** Quita el horario propio del turno: vuelve a usar el horario por defecto de la empresa. */
export async function resetShiftScheduleAction(input: z.infer<typeof resetSchema>): Promise<ShiftState> {
  const authz = await authorize();
  if ("error" in authz) return authz;
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };
  const { tenantId } = authz;

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.hrShiftSchedule.deleteMany({ where: { tenantId, orgUnitId: parsed.data.orgUnitId } })
    );
    revalidatePath("/settings/shifts");
    return { success: true };
  } catch (err) {
    console.error("[resetShiftScheduleAction]", err);
    return { error: "Error al restablecer. Intentá de nuevo." };
  }
}
