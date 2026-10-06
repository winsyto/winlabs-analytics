"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { sendEmail, welcomeEmailHtml, resetPasswordEmailHtml } from "@wla/email";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SALT_ROUNDS = 10;
const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENTE_URL ?? "https://winlabs-analytics-cliente.vercel.app";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function usersPath(tenantId: string) {
  return `/tenants/${tenantId}/users`;
}

// ---------------------------------------------------------------------------
// Create user
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  roleId: z.string().uuid(),
});

export type CreateUserState = { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean };

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const parsed = createUserSchema.safeParse({
    tenantId: formData.get("tenantId"),
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const { tenantId, name, email, roleId } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
  if (!tenant) return { error: "Tenant no encontrado" };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  try {
    await withTenantContext(tenantId, async (tx) => {
      const existing = await tx.user.findFirst({ where: { tenantId, email } });
      if (existing) throw new Error("EMAIL_EXISTS");

      const user = await tx.user.create({
        data: { tenantId, name, email, passwordHash, mustChangePassword: true },
      });

      await tx.userRole.create({ data: { tenantId, userId: user.id, roleId } });
    });

    await sendEmail({
      to: email,
      subject: `Bienvenido a ${tenant.name} — WinLabs Analytics`,
      html: welcomeEmailHtml({
        userName: name,
        tenantName: tenant.name,
        email,
        tempPassword,
        loginUrl: `${CLIENT_URL}/login`,
      }),
    });

    revalidatePath(usersPath(tenantId));
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_EXISTS") {
      return { fieldErrors: { email: ["Ya existe un usuario con ese email en este tenant"] } };
    }
    console.error("[createUserAction]", err);
    return { error: "Error al crear el usuario." };
  }
}

// ---------------------------------------------------------------------------
// Toggle user active
// ---------------------------------------------------------------------------

const toggleUserSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export type ToggleUserState = { error?: string; success?: boolean };

export async function toggleUserStatusAction(
  _prev: ToggleUserState,
  formData: FormData
): Promise<ToggleUserState> {
  const parsed = toggleUserSchema.safeParse({
    tenantId: formData.get("tenantId"),
    userId: formData.get("userId"),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { tenantId, userId, isActive } = parsed.data;
  try {
    await withTenantContext(tenantId, (tx) =>
      tx.user.update({ where: { id: userId }, data: { isActive } })
    );
    revalidatePath(usersPath(tenantId));
    return { success: true };
  } catch (err) {
    console.error("[toggleUserStatusAction]", err);
    return { error: "Error al actualizar el usuario." };
  }
}

// ---------------------------------------------------------------------------
// Delete user
// ---------------------------------------------------------------------------

const deleteUserSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type DeleteUserState = { error?: string; success?: boolean };

export async function deleteUserAction(
  _prev: DeleteUserState,
  formData: FormData
): Promise<DeleteUserState> {
  const parsed = deleteUserSchema.safeParse({
    tenantId: formData.get("tenantId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { tenantId, userId } = parsed.data;
  try {
    await withTenantContext(tenantId, (tx) =>
      tx.user.delete({ where: { id: userId } })
    );
    revalidatePath(usersPath(tenantId));
    return { success: true };
  } catch (err) {
    console.error("[deleteUserAction]", err);
    return { error: "Error al eliminar el usuario." };
  }
}

// ---------------------------------------------------------------------------
// Reset password
// ---------------------------------------------------------------------------

const resetPasswordSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type ResetPasswordState = { error?: string; success?: boolean };

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    tenantId: formData.get("tenantId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { tenantId, userId } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
  if (!tenant) return { error: "Tenant no encontrado" };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  try {
    const user = await withTenantContext(tenantId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: true },
        select: { email: true, name: true },
      })
    );

    await sendEmail({
      to: user.email,
      subject: `Contraseña reseteada — ${tenant.name}`,
      html: resetPasswordEmailHtml({
        userName: user.name,
        tenantName: tenant.name,
        email: user.email,
        tempPassword,
        loginUrl: `${CLIENT_URL}/login`,
      }),
    });

    revalidatePath(usersPath(tenantId));
    return { success: true };
  } catch (err) {
    console.error("[resetPasswordAction]", err);
    return { error: "Error al resetear la contraseña." };
  }
}
