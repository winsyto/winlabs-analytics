"use server";

import { prisma } from "@wla/db/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const toggleSchema = z.object({
  code: z.string().min(1),
  isActive: z.boolean(),
});

export type ToggleTemplateState = { error?: string; success?: boolean };

export async function toggleTemplateAction(
  _prev: ToggleTemplateState,
  formData: FormData
): Promise<ToggleTemplateState> {
  const parsed = toggleSchema.safeParse({
    code: formData.get("code"),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  try {
    await prisma.intTemplate.update({
      where: { code: parsed.data.code },
      data: { isActive: parsed.data.isActive },
    });
    revalidatePath("/templates");
    return { success: true };
  } catch (err) {
    console.error("[toggleTemplateAction]", err);
    return { error: "Error al actualizar el template." };
  }
}
