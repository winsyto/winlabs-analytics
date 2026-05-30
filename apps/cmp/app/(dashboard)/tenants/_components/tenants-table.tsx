import type { Tenant } from "@wla/db";
import { Badge } from "@wla/ui";

interface TenantsTableProps {
  tenants: Tenant[];
}

export function TenantsTable({ tenants }: TenantsTableProps) {
  if (tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">
          No hay tenants creados todavía.
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          Usá el botón &ldquo;Nuevo tenant&rdquo; para crear el primero.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Nombre
            </th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Slug
            </th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Estado
            </th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Creado
            </th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant, idx) => (
            <tr
              key={tenant.id}
              className={idx < tenants.length - 1 ? "border-b" : ""}
            >
              <td className="h-12 px-4 font-medium text-foreground">
                {tenant.name}
              </td>
              <td className="h-12 px-4 text-muted-foreground font-mono text-xs">
                {tenant.slug}
              </td>
              <td className="h-12 px-4">
                <Badge variant={tenant.isActive ? "default" : "secondary"}>
                  {tenant.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </td>
              <td className="h-12 px-4 text-muted-foreground">
                {new Date(tenant.createdAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
