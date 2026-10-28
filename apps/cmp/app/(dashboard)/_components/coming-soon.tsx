import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { PageHeader } from "@wla/ui";

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
  crumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="space-y-6 p-8">
      {crumbs && (
        <nav aria-label="Ruta de navegación" className="flex items-center gap-1 text-sm text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="transition-colors hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground">{c.label}</span>
              )}
              {i < crumbs.length - 1 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            </span>
          ))}
        </nav>
      )}
      <PageHeader title={title} description={description} />
      <div role="status" className="flex flex-col items-center rounded-xl border border-dashed bg-card p-12 text-center">
        <Icon className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Próximamente</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">Esta sección todavía no está disponible.</p>
      </div>
    </div>
  );
}
