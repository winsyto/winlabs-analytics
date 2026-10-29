import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

/** Ruta de navegación de una pantalla: sección del menú › opción del hub › pantalla actual. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {c.href && !last ? (
              <Link href={c.href} className="rounded px-0.5 transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={last ? "text-foreground" : ""}>
                {c.label}
              </span>
            )}
            {!last && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}
