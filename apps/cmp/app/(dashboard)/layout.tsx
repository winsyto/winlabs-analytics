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
  if (!session?.user?.id) redirect("/login");

  // La sesión tiene que ser de un usuario interno que siga existiendo y activo (un JWT vigente de un usuario dado de
  // baja, o de otra aplicación, no alcanza)
  const internalUser = await prisma.internalUser.findUnique({ where: { id: session.user.id }, select: { isActive: true } });
  if (!internalUser?.isActive) {
    await signOut({ redirectTo: "/login" });
    return null;
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={{ name: session.user?.name, email: session.user?.email }}
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
