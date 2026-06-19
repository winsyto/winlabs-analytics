import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
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
