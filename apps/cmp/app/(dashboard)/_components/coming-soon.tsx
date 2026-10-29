import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { Breadcrumb, type Crumb } from "./breadcrumb";

/** Pantalla de una sección que todavía no existe, con la ruta para volver al hub. */
export function ComingSoon({
  title,
  description,
  icon: Icon,
  crumbs,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  crumbs?: Crumb[];
}) {
  return (
    <div className="space-y-6 p-8">
      {crumbs && <Breadcrumb items={crumbs} />}
      <PageHeader title={title} description={description} />
      <div role="status" className="flex flex-col items-center rounded-xl border border-dashed bg-card p-12 text-center">
        <Icon className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Próximamente</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">Esta sección todavía no está disponible.</p>
      </div>
    </div>
  );
}
