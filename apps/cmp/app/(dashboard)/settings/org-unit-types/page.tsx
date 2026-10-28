import { Network } from "lucide-react";
import { ComingSoon } from "../../_components/coming-soon";

export const metadata = { title: "Tipos de unidades organizativas" };

export default function OrgUnitTypesPage() {
  return (
    <ComingSoon
      title="Tipos de unidades organizativas"
      description="Catálogo de tipos de unidad (empresa, sucursal, área, puesto...)."
      icon={Network}
      crumbs={[{ label: "Configuración", href: "/settings" }, { label: "Tipos de unidades organizativas" }]}
    />
  );
}
