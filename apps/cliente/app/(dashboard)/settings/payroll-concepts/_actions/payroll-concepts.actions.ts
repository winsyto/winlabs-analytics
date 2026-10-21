"use server";

import { auth } from "@/auth";
import { withTenantContext, assertCan } from "@wla/auth";
import { PAY_CLASS_SIDES, PAY_CONCEPT_TYPES } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserRole } from "../../_lib/role";

export type PayrollConfigState = { error?: string; success?: boolean };

const TYPE_CODES = PAY_CONCEPT_TYPES.map((t) => t.code) as [string, ...string[]];
const SIDE_CODES = PAY_CLASS_SIDES.map((s) => s.code) as [string, ...string[]];

const name = z.string().trim().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres");

async function requireAdmin(): Promise<{ tenantId: string } | { error: string }> {
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

function refresh() {
  revalidatePath("/settings/payroll-concepts");
}

const conceptSchema = z.object({
  id: z.number().int().positive(),
  name,
  conceptType: z.enum(TYPE_CODES),
  referenceTotal: z.enum(["gross", "net"]).nullable(),
  /** Clase puntual del concepto (gana sobre la del tipo). null = la que le toca por su tipo. */
  classId: z.number().int().positive().nullable(),
});

/** Guarda la clasificación de un concepto: tipo, clase puntual y si es el total bruto o neto de referencia. */
export async function updatePayConceptAction(input: z.infer<typeof conceptSchema>): Promise<PayrollConfigState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const parsed = conceptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, name: conceptName, conceptType, referenceTotal, classId } = parsed.data;
  const isAccumulator = conceptType === "accumulators";
  if (referenceTotal && !isAccumulator) return { error: "Solo un acumulador puede ser el sueldo bruto o el neto" };
  if (classId && isAccumulator) return { error: "Los acumuladores no pertenecen a una clase" };

  try {
    const result = await withTenantContext(ctx.tenantId, async (tx) => {
      const concept = await tx.payConcept.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } });
      if (!concept) return "El concepto no existe";
      if (classId) {
        const cls = await tx.payConceptClass.findFirst({ where: { id: classId, tenantId: ctx.tenantId }, select: { id: true } });
        if (!cls) return "La clase no existe";
      }
      // Un solo concepto es el bruto y uno el neto: se libera el anterior
      if (referenceTotal) {
        await tx.payConcept.updateMany({
          where: { tenantId: ctx.tenantId, referenceTotal, NOT: { id } },
          data: { referenceTotal: null },
        });
      }
      await tx.payConcept.update({
        where: { id },
        data: { name: conceptName, conceptType, referenceTotal, isClassified: true },
      });
      await tx.payClassRule.deleteMany({ where: { tenantId: ctx.tenantId, conceptId: id } });
      if (classId) await tx.payClassRule.create({ data: { tenantId: ctx.tenantId, classId, conceptId: id } });
      return null;
    });
    if (result) return { error: result };
    refresh();
    return { success: true };
  } catch (err) {
    console.error("[updatePayConceptAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}

const createClassSchema = z.object({ name, side: z.enum(SIDE_CODES) });

function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "clase"
  );
}

export async function createPayClassAction(input: z.infer<typeof createClassSchema>): Promise<PayrollConfigState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const parsed = createClassSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const result = await withTenantContext(ctx.tenantId, async (tx) => {
      const existing = await tx.payConceptClass.findMany({
        where: { tenantId: ctx.tenantId },
        select: { code: true, name: true, sortOrder: true },
      });
      if (existing.some((c) => c.name.toLowerCase() === parsed.data.name.toLowerCase())) return "Ya existe una clase con ese nombre";
      const base = slugify(parsed.data.name);
      const codes = new Set(existing.map((c) => c.code));
      let code = base;
      for (let n = 2; codes.has(code); n++) code = `${base}_${n}`;
      const sortOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1;
      await tx.payConceptClass.create({
        data: { tenantId: ctx.tenantId, code, name: parsed.data.name, side: parsed.data.side, sortOrder },
      });
      return null;
    });
    if (result) return { error: result };
    refresh();
    return { success: true };
  } catch (err) {
    console.error("[createPayClassAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}

const updateClassSchema = z.object({
  id: z.number().int().positive(),
  name,
  side: z.enum(SIDE_CODES),
  isActive: z.boolean(),
  /** Tipos de concepto que entran en la clase (todos los conceptos de esos tipos). */
  types: z.array(z.enum(TYPE_CODES)),
});

/** Guarda una clase: nombre, lado, estado y los tipos que agrupa. Un tipo pertenece a una sola clase. */
export async function updatePayClassAction(input: z.infer<typeof updateClassSchema>): Promise<PayrollConfigState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const parsed = updateClassSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, types, ...data } = parsed.data;
  if (types.includes("accumulators")) return { error: "Los acumuladores no pertenecen a una clase" };

  try {
    const result = await withTenantContext(ctx.tenantId, async (tx) => {
      const cls = await tx.payConceptClass.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } });
      if (!cls) return "La clase no existe";
      const dup = await tx.payConceptClass.findFirst({
        where: { tenantId: ctx.tenantId, name: { equals: data.name, mode: "insensitive" }, NOT: { id } },
        select: { id: true },
      });
      if (dup) return "Ya existe una clase con ese nombre";
      await tx.payConceptClass.update({ where: { id }, data });
      // Los tipos elegidos se mueven a esta clase; los que ya no figuran quedan sin clase
      await tx.payClassRule.deleteMany({
        where: {
          tenantId: ctx.tenantId,
          conceptId: null,
          OR: [{ classId: id }, ...(types.length > 0 ? [{ conceptType: { in: types } }] : [])],
        },
      });
      if (types.length > 0) {
        await tx.payClassRule.createMany({
          data: types.map((conceptType) => ({ tenantId: ctx.tenantId, classId: id, conceptType })),
        });
      }
      return null;
    });
    if (result) return { error: result };
    refresh();
    return { success: true };
  } catch (err) {
    console.error("[updatePayClassAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}
