import { Network } from "lucide-react";
import { ComingSoon } from "../../_components/coming-soon";

export const metadata = { title: "Unidades organizativas" };

export default function OrgUnitsSettingsPage() {
  return (
    <ComingSoon
      eyebrow="Configuración"
      title="Unidades organizativas"
      description="Empresas, sucursales, áreas, puestos y demás unidades que usan los dashboards."
      icon={Network}
      crumbs={[{ label: "Configuración", href: "/settings" }, { label: "Unidades organizativas" }]}
    />
  );
}
