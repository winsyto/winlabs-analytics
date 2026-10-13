import Link from "next/link";
import { DatabaseZap, SearchX } from "lucide-react";

/** Empty: el tenant todavía no tiene datos de esta fuente. */
export function DashboardEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card p-8 text-center">
      <DatabaseZap className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
      <Link
        href="/integrations"
        className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
      >
        Ir a Integraciones
      </Link>
    </div>
  );
}

/** No-results: hay datos, pero los filtros activos no devuelven coincidencias. */
export function DashboardNoResults({ clearHref }: { clearHref: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card p-8 text-center">
      <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold text-foreground">Sin resultados para los filtros activos</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Hay datos en el período, pero ninguna persona cumple con la combinación de filtros elegida.
      </p>
      <Link
        href={clearHref}
        className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
      >
        Limpiar filtros
      </Link>
    </div>
  );
}
