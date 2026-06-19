"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@wla/ui";
import { Building2, LayoutDashboard, Users } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/users", label: "Usuarios internos", icon: Users },
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
