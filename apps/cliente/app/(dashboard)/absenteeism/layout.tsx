import { DashboardGuard } from "../_dashboard-kit/dashboard-access";

export default function AbsenteeismLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard code="absenteeism">{children}</DashboardGuard>;
}
