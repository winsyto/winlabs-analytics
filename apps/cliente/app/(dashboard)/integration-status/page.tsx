import { Activity } from "lucide-react";
import { ComingSoon } from "../_components/coming-soon";

export const metadata = { title: "Status de integraciones" };

export default function IntegrationStatusPage() {
  return (
    <ComingSoon
      eyebrow="Data"
      title="Status de integraciones"
      description="Estado de las integraciones automáticas (API o SFTP): última ejecución, errores y próxima corrida."
      icon={Activity}
      crumbs={[{ label: "Data", href: "/data" }, { label: "Status de integraciones" }]}
    />
  );
}
