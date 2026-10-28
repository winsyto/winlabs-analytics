import { Users } from "lucide-react";
import { ComingSoon } from "../../_components/coming-soon";

export const metadata = { title: "Usuarios" };

export default function UsersPage() {
  return (
    <ComingSoon
      title="Usuarios"
      description="Usuarios internos de WinLabs: alta, baja y contraseñas."
      icon={Users}
      crumbs={[{ label: "Configuración", href: "/settings" }, { label: "Usuarios" }]}
    />
  );
}
