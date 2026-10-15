"use server";

import { auth } from "@/auth";
import { withTenantContext, assertCan } from "@wla/auth";
import { ABSENTEEISM_CLASSES } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserRole } from "../../_lib/role";

export type AbsenceTypeState = { error?: string; success?: boolean };

const schema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
  class: z.enum(ABSENTEEISM_CLASSES.map((c) => c.code) as [string, ...string[]]),
  countsAsAbsence: z.boolean(),
});

/** Guarda la clasificación de un tipo. Al guardar queda como clasificado (aunque haya llegado por archivo). */
export async function updateAbsenceTypeAction(input: z.infer<typeof schema>): Promise<AbsenceTypeState> {
  const session = await auth();
  if (!session?.user?.tenantId) return { error: "No autenticado" };
  const tenantId = session.user.tenantId;
  const role = await getCurrentUserRole(tenantId, session.user.id);
  try {
    assertCan(role, "edit", "settings");
  } catch {
    return { error: "No tenés permisos para editar la configuración" };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...data } = parsed.data;

  try {
    const res = await withTenantContext(tenantId, (tx) =>
      tx.cfgAbsenteeismType.updateMany({ where: { id, tenantId }, data: { ...data, isClassified: true } })
    );
    if (res.count === 0) return { error: "El tipo de ausencia no existe" };
    revalidatePath("/settings/absence-types");
    return { success: true };
  } catch (err) {
    console.error("[updateAbsenceTypeAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}
