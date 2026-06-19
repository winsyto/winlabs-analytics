"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@wla/ui";
import { BarChart3, LayoutDashboard, Settings, Users } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/settings/users", label: "Usuarios", icon: Users },
  { href: "/settings", label: "Configuración", icon: Settings },
];

interface AppSidebarProps {
  tenantName: string;
}

export function AppSidebar({ tenantName }: AppSidebarProps) {
  const pathname = usePathname();
  return (
    <SidebarNav
      navItems={navItems}
      pathname={pathname}
      LinkComponent={Link}
      logoContent={
        <div className="flex flex-col overflow-hidden">
          <span
            style={{ color: "#f5f5f0" }}
            className="text-sm font-semibold truncate leading-tight"
          >
            {tenantName}
          </span>
          <span className="text-xs opacity-50 truncate leading-tight">
            WinLabs Analytics
          </span>
        </div>
      }
    />
  );
}
