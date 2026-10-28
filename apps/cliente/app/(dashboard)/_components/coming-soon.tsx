import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { Breadcrumb, type Crumb } from "../_dashboard-kit/breadcrumb";

/** Pantalla de una sección que todavía no existe. */
export function ComingSoon({
  eyebrow,
  title,
  description,
  icon: Icon,
  crumbs,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  crumbs?: Crumb[];
}) {
  return (
    <div className="space-y-6 p-6">
      {crumbs && <Breadcrumb items={crumbs} />}
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div role="status" className="flex flex-col items-center rounded-xl border border-dashed bg-card p-12 text-center">
        <Icon className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Próximamente</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">Esta sección todavía no está disponible. Te avisaremos cuando esté lista.</p>
      </div>
    </div>
  );
}
