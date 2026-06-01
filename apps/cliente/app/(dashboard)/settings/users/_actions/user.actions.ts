"use server";

import { auth } from "@/auth";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { assertCan, type Role } from "@wla/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helper: obtener rol del usuario actual desde BD (no desde JWT — puede ser stale)
// ---------------------------------------------------------------------------

async function getCurrentUserRole(
  tenantId: string,
  userId: string | undefined
): Promise<Role> {
  if (!userId) return "viewer"; // sin userId no hay permisos
  const userRole = await withTenantContext(tenantId, (tx) =>
    tx.userRole.findFirst({
      where: { userId, tenantId },
      include: { role: { select: { name: true } } },
    })
  );
  return (userRole?.role.name ?? "viewer") as Role;
}

// ---------------------------------------------------------------------------
// updateUserRole
// ---------------------------------------------------------------------------

const updateRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  newRoleName: z.enum(["admin", "analyst", "viewer"]),
});

export type UpdateUserRoleState = { error?: string; success?: boolean };

export async function updateUserRoleAction(
  _prev: UpdateUserRoleState,
  formData: FormData
): Promise<UpdateUserRoleState> {
  const session = await auth();
  if (!session) return { error: "No autenticado" };

  const tenantId = session.user.tenantId;
  const currentUserId = session.user.id!;

  const parsed = updateRoleSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    newRoleName: formData.get("newRoleName"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { targetUserId, newRoleName } = parsed.data;

  // No puede cambiar su propio rol
  if (targetUserId === currentUserId) {
    return { error: "No podés cambiar tu propio rol" };
  }

  const currentRole = await getCurrentUserRole(tenantId, currentUserId);
  try {
    assertCan(currentRole, "edit", "users");
  } catch {
    return { error: "No tenés permisos para cambiar roles" };
  }

  try {
    await withTenantContext(tenantId, async (tx) => {
      // Buscar el rol por nombre dentro del tenant
      const role = await tx.role.findFirst({
        where: { tenantId, name: newRoleName },
      });
      if (!role) throw new Error(`Rol "${newRoleName}" no existe en este tenant`);

      // Eliminar asignación actual y crear la nueva (upsert por userId único)
      await tx.userRole.deleteMany({ where: { userId: targetUserId, tenantId } });
      await tx.userRole.create({
        data: { tenantId, userId: targetUserId, roleId: role.id },
      });
    });

    revalidatePath("/settings/users");
    return { success: true };
  } catch (err) {
    console.error("[updateUserRoleAction]", err);
    return { error: "Error al actualizar el rol. Intentá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// toggleUserActive
// ---------------------------------------------------------------------------

const toggleSchema = z.object({
  targetUserId: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

export type ToggleUserState = { error?: string; success?: boolean };

export async function toggleUserActiveAction(
  _prev: ToggleUserState,
  formData: FormData
): Promise<ToggleUserState> {
  const session = await auth();
  if (!session) return { error: "No autenticado" };

  const tenantId = session.user.tenantId;
  const currentUserId = session.user.id!;

  const parsed = toggleSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { targetUserId, active } = parsed.data;

  if (targetUserId === currentUserId) {
    return { error: "No podés desactivarte a vos mismo" };
  }

  const currentRole = await getCurrentUserRole(tenantId, currentUserId);
  try {
    assertCan(currentRole, "edit", "users");
  } catch {
    return { error: "No tenés permisos para modificar usuarios" };
  }

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.user.update({
        where: { id: targetUserId },
        data: { isActive: active === "true" },
      })
    );

    revalidatePath("/settings/users");
    return { success: true };
  } catch (err) {
    console.error("[toggleUserActiveAction]", err);
    return { error: "Error al actualizar el usuario. Intentá de nuevo." };
  }
}
