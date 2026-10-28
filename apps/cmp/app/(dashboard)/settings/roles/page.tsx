import { UserCog } from "lucide-react";
import { ComingSoon } from "../../_components/coming-soon";

export const metadata = { title: "Roles" };

export default function RolesPage() {
  return (
    <ComingSoon
      title="Roles"
      description="Roles de los usuarios internos de WinLabs."
      icon={UserCog}
      crumbs={[{ label: "Configuración", href: "/settings" }, { label: "Roles" }]}
    />
  );
}
