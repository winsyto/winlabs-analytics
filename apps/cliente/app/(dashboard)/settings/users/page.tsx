import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { canPerform, type Role } from "@wla/auth";
import { UsersTable } from "./_components/users-table";

export const dynamic = "force-dynamic";

async function getUsersWithRoles(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const users = await tx.user.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        userRoles: {
          include: { role: { select: { name: true } } },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      roleName: u.userRoles[0]?.role.name ?? "viewer",
    }));
  });
}

async function getCurrentUserRole(tenantId: string, userId: string | undefined): Promise<Role> {
  if (!userId) return "viewer"; // sin userId no hay permisos
  return withTenantContext(tenantId, async (tx) => {
    const ur = await tx.userRole.findFirst({
      where: { userId, tenantId },
      include: { role: { select: { name: true } } },
    });
    return (ur?.role.name ?? "viewer") as Role;
  });
}

export default async function UsersSettingsPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const currentUserId = session!.user.id!;

  const [users, currentRole] = await Promise.all([
    getUsersWithRoles(tenantId),
    getCurrentUserRole(tenantId, currentUserId),
  ]);

  const canManage = canPerform(currentRole, "edit", "users");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {users.length} usuario{users.length !== 1 ? "s" : ""} en este tenant
          {!canManage && (
            <span className="ml-2 text-xs">
              (solo lectura — necesitás rol admin para editar)
            </span>
          )}
        </p>
      </div>

      <UsersTable
        users={users}
        currentUserId={currentUserId}
        canManage={canManage}
      />
    </div>
  );
}
