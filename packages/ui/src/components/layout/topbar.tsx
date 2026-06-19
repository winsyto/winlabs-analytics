"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { colors } from "../../tokens";

interface TopbarUser {
  name?: string | null;
  email?: string | null;
}

interface TopbarProps {
  user: TopbarUser;
  tenantName?: string;
  logoutAction: () => Promise<void>;
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Topbar({ user, tenantName, logoutAction }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header
      style={{
        backgroundColor: colors.topbar.bg,
        borderBottom: `1px solid ${colors.topbar.border}`,
        color: colors.topbar.foreground,
        height: 56,
      }}
      className="flex items-center justify-between px-4 shrink-0"
    >
      {/* Left: tenant switcher (optional) */}
      <div className="flex items-center gap-2">
        {tenantName && (
          <span className="text-sm font-medium truncate max-w-[200px]">
            {tenantName}
          </span>
        )}
      </div>

      {/* Right: Bell + UserMenu */}
      <div className="flex items-center gap-2">
        {/* Notifications (stub) */}
        <button
          style={{ color: colors.topbar.foreground }}
          className="rounded-md p-1.5 hover:bg-white/10 transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{ color: colors.topbar.foreground }}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10 transition-colors text-sm"
          >
            {/* Avatar */}
            <span
              style={{ backgroundColor: "#dc2626", color: "#fff" }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0"
            >
              {getInitials(user.name)}
            </span>
            <span className="hidden sm:block truncate max-w-[140px]">
              {user.name ?? user.email}
            </span>
            <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
          </button>

          {menuOpen && (
            <div
              style={{
                backgroundColor: colors.topbar.bg,
                border: `1px solid ${colors.topbar.border}`,
              }}
              className="absolute right-0 top-full mt-1 w-56 rounded-md shadow-lg z-50 py-1"
            >
              <div className="px-3 py-2 border-b border-white/10">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs opacity-60 truncate">{user.email}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  style={{ color: colors.topbar.foreground }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
