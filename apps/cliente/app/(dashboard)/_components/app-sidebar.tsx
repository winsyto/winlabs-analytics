"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@wla/ui";
import { BarChart3, Database, FileText, Home, Settings } from "lucide-react";

/** Rutas de los dashboards: resaltan "Analítica" mientras se navega dentro de cualquiera de ellos. */
const DASHBOARD_ROUTES = ["/headcount", "/absenteeism", "/overtime", "/turnover", "/payroll"];

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/analytics", label: "Analítica", icon: BarChart3, match: DASHBOARD_ROUTES },
  { href: "/data", label: "Data", icon: Database, match: ["/integrations", "/integration-status"] },
  { href: "/reports", label: "Reportes", icon: FileText },
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
