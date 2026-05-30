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
