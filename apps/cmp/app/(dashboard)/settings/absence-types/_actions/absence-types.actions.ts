"use server";

import { auth } from "@/auth";
import { prisma } from "@wla/db/client";
import { ABSENTEEISM_CLASSES } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type AbsenceTypeState = { error?: string; success?: boolean };

const classCode = z.enum(ABSENTEEISM_CLASSES.map((c) => c.code) as [string, ...string[]]);

const fields = {
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
  class: classCode,
  countsAsAbsence: z.boolean(),
  isActive: z.boolean(),
};

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{1,50}$/, "El código admite letras, números y guion bajo (máx. 50)"),
  ...fields,
});

const updateSchema = z.object({ id: z.number().int().positive(), ...fields });

async function requireInternalUser(): Promise<boolean> {
  const session = await auth();
  return !!session?.user?.id;
}

export async function createAbsenceTypeDefaultAction(input: z.infer<typeof createSchema>): Promise<AbsenceTypeState> {
  if (!(await requireInternalUser())) return { error: "No autenticado" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const data = parsed.data;

  try {
    const exists = await prisma.cfgAbsenteeismTypeDefault.findUnique({ where: { code: data.code } });
    if (exists) return { error: "Ya existe un tipo con ese código" };
    const last = await prisma.cfgAbsenteeismTypeDefault.aggregate({ _max: { sortOrder: true } });
    await prisma.cfgAbsenteeismTypeDefault.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    revalidatePath("/settings/absence-types");
    return { success: true };
  } catch (err) {
    console.error("[createAbsenceTypeDefaultAction]", err);
    return { error: "Error al crear el tipo. Intentá de nuevo." };
  }
}

export async function updateAbsenceTypeDefaultAction(input: z.infer<typeof updateSchema>): Promise<AbsenceTypeState> {
  if (!(await requireInternalUser())) return { error: "No autenticado" };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...data } = parsed.data;

  try {
    await prisma.cfgAbsenteeismTypeDefault.update({ where: { id }, data });
    revalidatePath("/settings/absence-types");
    return { success: true };
  } catch (err) {
    console.error("[updateAbsenceTypeDefaultAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}
