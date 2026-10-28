import { DashboardGuard } from "../_dashboard-kit/dashboard-access";

export default function TurnoverLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard code="turnover">{children}</DashboardGuard>;
}
