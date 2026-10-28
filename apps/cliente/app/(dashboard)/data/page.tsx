import { Activity, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { HubCard, HubGroup } from "../_components/hub-card";

export const metadata = { title: "Data" };

export default function DataHubPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader eyebrow="Data" title="Data" description="Cómo llegan los datos a tus dashboards: cargas manuales de archivos y, más adelante, integraciones automáticas." />
      <HubGroup title="Integraciones">
        <HubCard
          href="/integrations"
          icon={FileSpreadsheet}
          title="Integraciones manuales"
          description="Subí archivos de tu sistema de RRHH (personas, asistencia, ausentismo y liquidaciones) para actualizar los datos."
        />
        <HubCard
          href="/integration-status"
          icon={Activity}
          title="Status de integraciones"
          description="Estado de las integraciones automáticas (API o SFTP): última ejecución, errores y próxima corrida."
          soon
        />
      </HubGroup>
    </div>
  );
}
