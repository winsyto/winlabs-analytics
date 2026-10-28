import { ShieldCheck } from "lucide-react";
import { ComingSoon } from "../../_components/coming-soon";

export const metadata = { title: "Matriz de permisos" };

export default function PermissionsPage() {
  return (
    <ComingSoon
      title="Matriz de permisos"
      description="Qué puede hacer cada rol en la consola."
      icon={ShieldCheck}
      crumbs={[{ label: "Configuración", href: "/settings" }, { label: "Matriz de permisos" }]}
    />
  );
}
