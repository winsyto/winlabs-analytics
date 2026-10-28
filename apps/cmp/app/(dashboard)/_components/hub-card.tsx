import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Tarjeta de un hub (Tenants, Integraciones, Configuración): ícono, nombre, descripción corta y estado. */
export function HubCard({
  href,
  icon: Icon,
  title,
  description,
  soon,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Opción todavía no disponible */
  soon?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {soon && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Próximamente</span>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

/** Grupo de tarjetas con título. */
export function HubGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`hub-${title}`} className="space-y-2">
      <h2 id={`hub-${title}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
