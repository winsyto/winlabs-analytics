import { DashboardGuard } from "../_dashboard-kit/dashboard-access";

export default function OvertimeLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard code="overtime">{children}</DashboardGuard>;
}
