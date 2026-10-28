import { Plug } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { HubCard, HubGroup } from "../_components/hub-card";

export const metadata = { title: "Integraciones" };

export default function IntegrationsHubPage() {
  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Integraciones" description="Integraciones de los tenants con sus fuentes de datos." />
      <HubGroup title="General">
        <HubCard href="/integrations/active" icon={Plug} title="Integraciones activas" description="Crear, pausar y activar las integraciones de cada tenant y ver sus ejecuciones." />
      </HubGroup>
    </div>
  );
}
