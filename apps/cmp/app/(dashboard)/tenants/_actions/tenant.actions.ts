"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SALT_ROUNDS = 10;

const DEFAULT_ROLES = [
  { name: "admin", description: "Acceso completo al tenant" },
  { name: "analyst", description: "Puede crear y editar reportes" },
  { name: "viewer", description: "Solo lectura" },
] as const;

// ---------------------------------------------------------------------------
// Schema de validación
// ---------------------------------------------------------------------------

const createTenantSchema = z.object({
  slug: z
    .string()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(32, "El slug no puede superar 32 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Solo se permiten letras minúsculas, números y guiones"
    ),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(80),
  adminEmail: z.string().email("Email inválido"),
  adminName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(80),
  adminPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export type CreateTenantState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof CreateTenantInput, string[]>>;
  success?: boolean;
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function createTenantAction(
  _prevState: CreateTenantState,
  formData: FormData
): Promise<CreateTenantState> {
  const raw = {
    slug: formData.get("slug") as string,
    name: formData.get("name") as string,
    adminEmail: formData.get("adminEmail") as string,
    adminName: formData.get("adminName") as string,
    adminPassword: formData.get("adminPassword") as string,
  };

  const parsed = createTenantSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { slug, name, adminEmail, adminName, adminPassword } = parsed.data;

  // Verificar slug único antes de crear (mejor UX que dejar fallar la BD)
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    return { fieldErrors: { slug: ["Este slug ya está en uso"] } };
  }

  // ⚠️ Hash FUERA de la transacción — bcrypt es lento y puede provocar timeout
  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  try {
    // 1. Crear el tenant (fuera de RLS context — no tiene tenantId propio)
    const tenant = await prisma.tenant.create({
      data: { slug, name },
    });

    // 2. Dentro del contexto RLS del nuevo tenant: roles + usuario admin
    await withTenantContext(tenant.id, async (tx) => {
      // Crear roles por defecto
      const createdRoles = await Promise.all(
        DEFAULT_ROLES.map((r) =>
          tx.role.create({
            data: { tenantId: tenant.id, name: r.name, description: r.description },
          })
        )
      );

      const adminRole = createdRoles.find((r) => r.name === "admin")!;

      // Crear usuario admin
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          name: adminName,
          passwordHash,
        },
      });

      // Asignar rol admin al usuario
      await tx.userRole.create({
        data: {
          tenantId: tenant.id,
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });
    });

    revalidatePath("/tenants");
    return { success: true };
  } catch (err) {
    console.error("[createTenantAction]", err);
    return { error: "Ocurrió un error al crear el tenant. Intentá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Update tenant info (name + slug)
// ---------------------------------------------------------------------------

const updateTenantInfoSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Solo se permiten letras minúsculas, números y guiones"),
});

export type UpdateTenantInfoState = { error?: string; success?: boolean };

export async function updateTenantInfoAction(
  _prev: UpdateTenantInfoState,
  formData: FormData
): Promise<UpdateTenantInfoState> {
  const parsed = updateTenantInfoSchema.safeParse({
    tenantId: formData.get("tenantId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos inválidos" };

  const { tenantId, name, slug } = parsed.data;

  const existing = await prisma.tenant.findFirst({
    where: { slug, NOT: { id: tenantId } },
  });
  if (existing) return { error: "El slug ya está en uso por otro tenant" };

  try {
    await prisma.tenant.update({ where: { id: tenantId }, data: { name, slug } });
    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateTenantInfoAction]", err);
    return { error: "Error al actualizar el tenant." };
  }
}

// ---------------------------------------------------------------------------
// Delete tenant (hard delete + cascade domain tables)
// ---------------------------------------------------------------------------

const deleteTenantSchema = z.object({
  tenantId: z.string().uuid(),
  slugConfirmation: z.string().min(1),
});

export type DeleteTenantState = { error?: string; success?: boolean };

export async function deleteTenantAction(
  _prev: DeleteTenantState,
  formData: FormData
): Promise<DeleteTenantState> {
  const parsed = deleteTenantSchema.safeParse({
    tenantId: formData.get("tenantId"),
    slugConfirmation: formData.get("slugConfirmation"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { tenantId, slugConfirmation } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { error: "Tenant no encontrado" };
  if (tenant.slug !== slugConfirmation) return { error: "El slug no coincide" };

  try {
    await prisma.$transaction(async (tx) => {
      // Domain tables have no FK to tenants — must delete manually in dependency order
      await tx.$executeRaw`DELETE FROM att_time_daily WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM att_absenteeism_events WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM pay_entries WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM hr_people_history WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM hr_people WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM hr_org_units WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM cfg_absenteeism_types WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM pay_periods WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM pay_concepts WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM int_runs WHERE tenant_id = ${tenantId}::uuid`;
      await tx.$executeRaw`DELETE FROM int_tenant_integrations WHERE tenant_id = ${tenantId}::uuid`;
      // tenant.delete cascades: users, roles, user_roles, jobs, job_runs, job_events, job_checkpoints, audit_log
      await tx.tenant.delete({ where: { id: tenantId } });
    });

    revalidatePath("/tenants");
    return { success: true };
  } catch (err) {
    console.error("[deleteTenantAction]", err);
    return { error: "Error al eliminar el tenant." };
  }
}

// ---------------------------------------------------------------------------
// Toggle tenant status
// ---------------------------------------------------------------------------

const toggleTenantSchema = z.object({
  tenantId: z.string().uuid(),
  isActive: z.boolean(),
});

export type ToggleTenantState = { error?: string; success?: boolean };

export async function toggleTenantStatusAction(
  _prev: ToggleTenantState,
  formData: FormData
): Promise<ToggleTenantState> {
  const parsed = toggleTenantSchema.safeParse({
    tenantId: formData.get("tenantId"),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { tenantId, isActive } = parsed.data;

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive },
    });
    revalidatePath("/tenants");
    return { success: true };
  } catch (err) {
    console.error("[toggleTenantStatusAction]", err);
    return { error: "Error al actualizar el estado del tenant." };
  }
}
