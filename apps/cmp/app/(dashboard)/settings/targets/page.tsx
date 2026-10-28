import { Target } from "lucide-react";
import { ComingSoon } from "../../_components/coming-soon";

export const metadata = { title: "Metas" };

export default function TargetsPage() {
  return (
    <ComingSoon
      title="Metas"
      description="Valores base de las metas que cada tenant puede redefinir."
      icon={Target}
      crumbs={[{ label: "Configuración", href: "/settings" }, { label: "Metas" }]}
    />
  );
}
