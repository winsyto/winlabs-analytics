import { Building2 } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { HubCard, HubGroup } from "../_components/hub-card";

export const metadata = { title: "Tenants" };

export default function TenantsHubPage() {
  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Tenants" description="Alta y administración de las empresas que usan la plataforma." />
      <HubGroup title="General">
        <HubCard href="/tenants/list" icon={Building2} title="Tenants" description="Crear, editar y configurar cada empresa: módulos, dashboards, unidades, asistencia y usuarios." />
      </HubGroup>
    </div>
  );
}
