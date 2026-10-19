"use server";

import { auth } from "@/auth";
import { withTenantContext, assertCan } from "@wla/auth";
import { TIME_ENTRY_CATEGORIES } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserRole } from "../../_lib/role";

export type TimeEntryTypeState = { error?: string; success?: boolean };

const schema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
  category: z.enum(TIME_ENTRY_CATEGORIES.map((c) => c.code) as [string, ...string[]]),
});

/** Guarda la clasificación de un tipo de hora. Al guardar queda como clasificado (aunque haya llegado por archivo). */
export async function updateTimeEntryTypeAction(input: z.infer<typeof schema>): Promise<TimeEntryTypeState> {
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
      tx.cfgTenantTimeEntryType.updateMany({
        where: { id, tenantId },
        data: { ...data, sign: data.category === "absence" ? -1 : 1, isClassified: true },
      })
    );
    if (res.count === 0) return { error: "El tipo de hora no existe" };
    revalidatePath("/settings/time-entry-types");
    return { success: true };
  } catch (err) {
    console.error("[updateTimeEntryTypeAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}
