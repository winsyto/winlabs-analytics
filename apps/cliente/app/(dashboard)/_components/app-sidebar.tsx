"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@wla/ui";
import { BarChart3, CalendarOff, FileSpreadsheet, Timer, UserMinus, Wallet, LayoutDashboard, Settings, Users, UsersRound } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/headcount", label: "Headcount", icon: UsersRound, dashboard: "headcount" },
  { href: "/absenteeism", label: "Ausentismos", icon: CalendarOff, dashboard: "absenteeism" },
  { href: "/overtime", label: "Horas extras", icon: Timer, dashboard: "overtime" },
  { href: "/turnover", label: "Rotación", icon: UserMinus, dashboard: "turnover" },
  { href: "/payroll", label: "Payroll", icon: Wallet, dashboard: "payroll" },
  { href: "/integrations", label: "Integraciones", icon: FileSpreadsheet },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/settings/users", label: "Usuarios", icon: Users },
  { href: "/settings", label: "Configuración", icon: Settings },
];

interface AppSidebarProps {
  tenantName: string;
  /** Dashboards activos del tenant (hub de dashboards): los demás no aparecen en el menú */
  enabledDashboards: string[];
}

export function AppSidebar({ tenantName, enabledDashboards }: AppSidebarProps) {
  const pathname = usePathname();
  return (
    <SidebarNav
      navItems={navItems.filter((i) => !i.dashboard || enabledDashboards.includes(i.dashboard))}
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
