import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { PageHeader } from "@wla/ui";
import { ChevronRight } from "lucide-react";
import { UsersTable } from "./_components/users-table";
import { CreateUserDialog } from "./_components/create-user-dialog";

export const dynamic = "force-dynamic";

async function getData(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) return null;

  const [users, roles] = await withTenantContext(tenantId, async (tx) => {
    return Promise.all([
      tx.user.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          userRoles: { select: { role: { select: { name: true } } } },
        },
      }),
      tx.role.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
  });

  return {
    tenant,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      roles: u.userRoles.map((ur) => ur.role.name),
    })),
    roles,
  };
}

export default async function TenantUsersPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const data = await getData(tenantId);
  if (!data) notFound();

  const { tenant, users, roles } = data;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/tenants" className="hover:text-foreground transition-colors">Tenants</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/tenants/${tenantId}`} className="hover:text-foreground transition-colors">{tenant.name}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">Usuarios</span>
      </div>

      <PageHeader
        title={`Usuarios — ${tenant.name}`}
        description={`${users.length} usuario${users.length !== 1 ? "s" : ""} registrado${users.length !== 1 ? "s" : ""}`}
        actions={<CreateUserDialog tenantId={tenantId} roles={roles} />}
      />

      <UsersTable users={users} tenantId={tenantId} />
    </div>
  );
}
