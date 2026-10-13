import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="text-xs">
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="rounded px-1 py-0.5 hover:bg-muted hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-foreground" : ""}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3 w-3" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
