import { withTenantContext, type Role } from "@wla/auth";

/** Rol del usuario actual leído de la BD (el JWT puede estar desactualizado). Sin usuario = viewer. */
export async function getCurrentUserRole(tenantId: string, userId: string | undefined): Promise<Role> {
  if (!userId) return "viewer";
  return withTenantContext(tenantId, async (tx) => {
    const ur = await tx.userRole.findFirst({
      where: { userId, tenantId },
      include: { role: { select: { name: true } } },
    });
    return (ur?.role.name ?? "viewer") as Role;
  });
}
