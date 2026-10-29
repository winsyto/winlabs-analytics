"use server";

import { auth } from "@/auth";
import { prisma } from "@wla/db/client";
import { TIME_ENTRY_CATEGORIES } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type TimeEntryTypeState = { error?: string; success?: boolean };

const category = z.enum(TIME_ENTRY_CATEGORIES.map((c) => c.code) as [string, ...string[]]);

const fields = {
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
  category,
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

const updateSchema = z.object({ code: z.string().min(1).max(50), ...fields });

/** Las ausencias restan del total trabajado; el resto suma. */
const signOf = (cat: string) => (cat === "absence" ? -1 : 1);

async function requireInternalUser(): Promise<boolean> {
  const session = await auth();
  return !!session?.user?.id;
}

export async function createTimeEntryTypeDefaultAction(input: z.infer<typeof createSchema>): Promise<TimeEntryTypeState> {
  if (!(await requireInternalUser())) return { error: "No autenticado" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const data = parsed.data;

  try {
    const exists = await prisma.cfgTimeEntryType.findUnique({ where: { code: data.code } });
    if (exists) return { error: "Ya existe un tipo con ese código" };
    const last = await prisma.cfgTimeEntryType.aggregate({ _max: { sortOrder: true } });
    await prisma.cfgTimeEntryType.create({
      data: { ...data, sign: signOf(data.category), sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    revalidatePath("/settings/time-entry-types");
    return { success: true };
  } catch (err) {
    console.error("[createTimeEntryTypeDefaultAction]", err);
    return { error: "Error al crear el tipo. Intentá de nuevo." };
  }
}

export async function updateTimeEntryTypeDefaultAction(input: z.infer<typeof updateSchema>): Promise<TimeEntryTypeState> {
  if (!(await requireInternalUser())) return { error: "No autenticado" };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { code, ...data } = parsed.data;

  try {
    await prisma.cfgTimeEntryType.update({ where: { code }, data: { ...data, sign: signOf(data.category) } });
    revalidatePath("/settings/time-entry-types");
    return { success: true };
  } catch (err) {
    console.error("[updateTimeEntryTypeDefaultAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}
