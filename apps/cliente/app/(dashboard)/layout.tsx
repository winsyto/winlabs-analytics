import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@wla/db/client";
import { Topbar } from "@wla/ui";
import { AppSidebar } from "./_components/app-sidebar";
import { colors } from "@wla/ui/tokens";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  if (!session.user?.tenantId) {
    // Sesión corrupta o de un esquema de token anterior — auto-recuperación
    await signOut({ redirectTo: "/login" });
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { name: true },
  });

  const tenantName = tenant?.name ?? session.user.tenantSlug;

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar tenantName={tenantName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={{ name: session.user.name, email: session.user.email }}
          tenantName={tenantName}
          logoutAction={logout}
        />
        <main
          style={{ backgroundColor: colors.content.background }}
          className="flex-1 overflow-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
