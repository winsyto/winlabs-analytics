import Link from "next/link";
import { PageHeader } from "@wla/ui";
import { Breadcrumb } from "../../../_components/breadcrumb";

/** Secciones de un tenant: cada una es una página que muestra y edita solo lo suyo */
export const TENANT_SECTION_LIST = [
  { key: "info", label: "Ficha", path: "" },
  { key: "org-units", label: "Unidades organizativas y dimensiones", path: "/org-units" },
  { key: "attendance", label: "Asistencia", path: "/attendance" },
  { key: "users", label: "Usuarios", path: "/users" },
  { key: "integrations", label: "Integraciones", path: "/integrations" },
] as const;

export type TenantSectionKey = (typeof TENANT_SECTION_LIST)[number]["key"];

/** Encabezado común de las páginas de sección: ruta, título y salto entre secciones del mismo tenant */
export function TenantSectionHeader({
  tenant,
  section,
  title,
  description,
  actions,
}: {
  tenant: { id: string; name: string };
  section: Exclude<TenantSectionKey, "info">;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Tenants", href: "/tenants" },
          { label: "Tenants", href: "/tenants/list" },
          { label: tenant.name, href: `/tenants/${tenant.id}` },
          { label: title },
        ]}
      />
      <PageHeader title={title} description={`${tenant.name} · ${description}`} actions={actions} />
      <nav aria-label="Secciones del tenant" className="flex flex-wrap gap-1.5">
        {TENANT_SECTION_LIST.map((s) => {
          const current = s.key === section;
          return (
            <Link
              key={s.key}
              href={`/tenants/${tenant.id}${s.path}`}
              aria-current={current ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                current ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
