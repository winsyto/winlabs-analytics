"use server";

import { auth } from "@/auth";
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

    revalidatePath("/tenants");
    return { success: true };
  } catch (err) {
    console.error("[updateTenantModulesAction]", err);
    return { error: "Error al actualizar. Intentá de nuevo." };
  }
}
