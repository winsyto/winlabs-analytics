"use client";

import { Fragment, useState } from "react";
import { ChevronRight, Menu } from "lucide-react";
import { cn } from "../../lib/utils";
import { colors } from "../../tokens";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Título de la sección a la que pertenece. Un ítem con una sección distinta a la del anterior abre una sección nueva */
  section?: string;
  /** Otras rutas que dejan este ítem marcado como activo (por ejemplo, las de los dashboards de un hub) */
  match?: string[];
}

interface SidebarNavProps {
  navItems: NavItem[];
  pathname: string;
  logoContent: React.ReactNode;
  /** Pass `Link` from `next/link` for client-side navigation */
  LinkComponent: React.ComponentType<{ href: string; title?: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }>;
}

const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

export function SidebarNav({ navItems, pathname, logoContent, LinkComponent }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
        backgroundColor: colors.sidebar.bg,
        borderRight: `1px solid ${colors.sidebar.border}`,
        transition: "width 200ms ease",
      }}
      className="flex h-screen flex-col shrink-0 overflow-hidden"
    >
      {/* Logo + toggle */}
      <div
        style={{ borderBottom: `1px solid ${colors.sidebar.border}`, height: 56 }}
        className="flex items-center justify-between px-3 shrink-0"
      >
        {!collapsed && (
          <div className="flex-1 overflow-hidden pr-2">{logoContent}</div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{ color: colors.sidebar.foreground }}
          className="rounded-md p-1.5 hover:bg-white/10 transition-colors shrink-0"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, section, match }, index) => {
          const isActive = isUnder(pathname, href) || (match ?? []).some((m) => isUnder(pathname, m));
          // Un cambio de sección abre un bloque nuevo: con título si la sección lo tiene, solo con un divisor si no
          const opensSection = index === 0 ? section !== undefined : section !== navItems[index - 1]?.section;
          return (
            <Fragment key={href}>
              {opensSection &&
                (collapsed || section === undefined ? (
                  <div
                    aria-hidden
                    style={{ borderTop: `1px solid ${colors.sidebar.border}` }}
                    className="mx-2 my-2"
                  />
                ) : (
                  <p
                    style={{ color: colors.sidebar.foreground }}
                    className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider opacity-50"
                  >
                    {section}
                  </p>
                ))}
              <LinkComponent
                href={href}
                title={collapsed ? label : undefined}
                style={
                  isActive
                    ? { backgroundColor: colors.sidebar.activeBg, color: colors.sidebar.activeFg }
                    : { color: colors.sidebar.foreground }
                }
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                  "hover:bg-white/10",
                  isActive && "font-semibold hover:opacity-90",
                  collapsed && "justify-center"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </LinkComponent>
            </Fragment>
          );
        })}
      </nav>
    </aside>
  );
}
