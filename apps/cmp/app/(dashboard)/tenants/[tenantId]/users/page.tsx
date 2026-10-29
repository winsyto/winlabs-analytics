import { notFound } from "next/navigation";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { UsersTable } from "./_components/users-table";
import { CreateUserDialog } from "./_components/create-user-dialog";
import { Pager, listHref, paginate } from "../../../_components/list-controls";
import { TenantSectionHeader } from "../_components/tenant-section-header";

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
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const data = await getData(tenantId);
  if (!data) notFound();

  const { tenant, users, roles } = data;
  const { page, pages, skip, take } = paginate(users.length, Math.max(1, Number(sp.page) || 1));

  return (
    <div className="space-y-4 p-8">
      <TenantSectionHeader
        tenant={tenant}
        section="users"
        title="Usuarios"
        description="usuarios que acceden al portal del tenant"
        actions={<CreateUserDialog tenantId={tenantId} roles={roles} />}
      />

      <div className="rounded-md border bg-card">
        <UsersTable users={users.slice(skip, skip + take)} tenantId={tenantId} />
        {users.length > 0 && (
          <Pager
            page={page}
            pages={pages}
            total={users.length}
            noun={["usuario", "usuarios"]}
            hrefFor={(p) => listHref(`/tenants/${tenantId}/users`, { page: p })}
          />
        )}
      </div>
    </div>
  );
}
