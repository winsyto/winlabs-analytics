"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@wla/ui";
import { Building2, LayoutDashboard, Plug, Settings } from "lucide-react";

/** Páginas de catálogos y ajustes que cuelgan del hub de Configuración: lo mantienen marcado en el menú. */
const SETTINGS_ROUTES = ["/absence-types", "/time-entry-types", "/dashboards", "/templates", "/data-models"];

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/integrations", label: "Integraciones", icon: Plug },
  { href: "/settings", label: "Configuración", icon: Settings, match: SETTINGS_ROUTES },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <SidebarNav
      navItems={navItems}
      pathname={pathname}
      LinkComponent={Link}
      logoContent={
        <span style={{ color: "#f5f5f0" }} className="text-sm font-semibold truncate">
          WinLabs{" "}
          <span className="font-normal opacity-60">CMP</span>
        </span>
      }
    />
  );
}
