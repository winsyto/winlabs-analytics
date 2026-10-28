import { DashboardGuard } from "../_dashboard-kit/dashboard-access";

export default function HeadcountLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard code="headcount">{children}</DashboardGuard>;
}
