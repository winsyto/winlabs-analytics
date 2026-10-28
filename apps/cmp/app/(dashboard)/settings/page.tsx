import {
  CalendarOff,
  Clock,
  LayoutGrid,
  LayoutList,
  Layers,
  Network,
  ShieldCheck,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { PageHeader } from "@wla/ui";
import { HubCard, HubGroup } from "../_components/hub-card";

export const metadata = { title: "Configuración" };

export default function SettingsHubPage() {
  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Configuración" description="Catálogos y ajustes globales de la plataforma, agrupados por tema." />

      <HubGroup title="Básicas">
        <HubCard href="/settings/org-unit-types" icon={Network} title="Tipos de unidades organizativas" description="Catálogo de tipos de unidad (empresa, sucursal, área, puesto...)." soon />
        <HubCard href="/absence-types" icon={CalendarOff} title="Tipos de ausencia" description="Catálogo base de tipos de ausencia que heredan los tenants nuevos." />
        <HubCard href="/time-entry-types" icon={Clock} title="Tipos de hora" description="Catálogo base de tipos de hora y su categoría." />
        <HubCard href="/data-models" icon={Layers} title="Módulos analíticos" description="Módulos de datos (Personas, Asistencia, Liquidaciones) activos en cada tenant." />
      </HubGroup>

      <HubGroup title="Dashboards">
        <HubCard href="/dashboards" icon={LayoutGrid} title="Dashboards" description="Qué dashboards ve cada tenant." />
        <HubCard href="/settings/targets" icon={Target} title="Metas" description="Valores base de las metas que cada tenant puede redefinir." soon />
      </HubGroup>

      <HubGroup title="Integraciones">
        <HubCard href="/templates" icon={LayoutList} title="Templates de integración" description="Templates disponibles para crear integraciones (activar o inactivar)." />
      </HubGroup>

      <HubGroup title="Seguridad">
        <HubCard href="/settings/roles" icon={UserCog} title="Roles" description="Roles de los usuarios internos de WinLabs." soon />
        <HubCard href="/settings/users" icon={Users} title="Usuarios" description="Usuarios internos de WinLabs (alta, baja y contraseñas)." soon />
        <HubCard href="/settings/permissions" icon={ShieldCheck} title="Matriz de permisos" description="Qué puede hacer cada rol en la consola." soon />
      </HubGroup>
    </div>
  );
}
