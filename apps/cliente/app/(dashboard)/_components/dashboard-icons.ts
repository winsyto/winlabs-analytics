import { CalendarOff, LayoutDashboard, Timer, UserMinus, UsersRound, Wallet, type LucideIcon } from "lucide-react";

/** Íconos de los dashboards del catálogo (cfg_dashboards.icon, en kebab-case). */
const ICONS: Record<string, LucideIcon> = {
  "users-round": UsersRound,
  "calendar-off": CalendarOff,
  timer: Timer,
  "user-minus": UserMinus,
  wallet: Wallet,
};

export const dashboardIcon = (name: string | null | undefined): LucideIcon => (name ? (ICONS[name] ?? LayoutDashboard) : LayoutDashboard);
