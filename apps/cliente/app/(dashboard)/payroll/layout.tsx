import { DashboardGuard } from "../_dashboard-kit/dashboard-access";

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard code="payroll">{children}</DashboardGuard>;
}
