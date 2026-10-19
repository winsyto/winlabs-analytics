"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@wla/ui";
import { Building2, CalendarOff, Clock, LayoutDashboard, LayoutList, Plug, Users } from "lucide-react";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",           icon: LayoutDashboard },
  { href: "/tenants",      label: "Tenants",              icon: Building2 },
  { href: "/integrations", label: "Integraciones",       icon: Plug },
  { href: "/templates",    label: "Templates",            icon: LayoutList },
  { href: "/absence-types", label: "Tipos de ausencia",  icon: CalendarOff },
  { href: "/time-entry-types", label: "Tipos de hora",   icon: Clock },
  { href: "/users",        label: "Usuarios internos",   icon: Users },
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
