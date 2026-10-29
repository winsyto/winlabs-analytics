import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Estándar de grillas: filas por página que entran de un vistazo en una pantalla de 15,6" sin scroll (D-143) */
export const PAGE_SIZE = 12;

/** Lee y normaliza `?q` y `?page` de una lista paginada */
export function listParams(sp: { q?: string; page?: string }) {
  return { q: (sp.q ?? "").trim().slice(0, 100), page: Math.max(1, Number(sp.page) || 1) };
}

/** Calcula la página efectiva y el salto de filas para una consulta paginada */
export function paginate(total: number, requestedPage: number) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  return { page, pages, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

/** Arma el href de una lista conservando búsqueda y filtros (los valores vacíos se omiten) */
export function listHref(base: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (k === "page" && Number(v) <= 1)) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** Búsqueda por texto (formulario GET) con filtros opcionales ya renderizados en `children` */
export function SearchForm({
  action,
  q,
  placeholder,
  children,
}: {
  action: string;
  q: string;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <form method="get" action={action} role="search" className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-72 rounded-md border bg-card px-2.5 py-1.5 text-sm"
      />
      {children}
      <button type="submit" className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">
        Buscar
      </button>
      {q && (
        <Link href={action} className="text-sm text-muted-foreground hover:text-foreground">
          Limpiar
        </Link>
      )}
    </form>
  );
}

function PagerLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const cls = "inline-flex items-center gap-1 rounded border px-2 py-1";
  return disabled ? (
    <span className={`${cls} text-muted-foreground opacity-50`}>{children}</span>
  ) : (
    <Link href={href} className={`${cls} hover:bg-muted`}>
      {children}
    </Link>
  );
}

/** Pie de una grilla paginada */
export function Pager({
  page,
  pages,
  total,
  noun,
  hrefFor,
}: {
  page: number;
  pages: number;
  total: number;
  /** Sustantivo en singular y plural, p. ej. ["tenant", "tenants"] */
  noun: [string, string];
  hrefFor: (page: number) => string;
}) {
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between border-t px-4 py-2 text-xs">
      <span className="text-muted-foreground">
        Página {page} de {pages} · {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      <span className="flex items-center gap-2">
        <PagerLink href={hrefFor(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
        </PagerLink>
        <PagerLink href={hrefFor(page + 1)} disabled={page >= pages}>
          Siguiente <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </PagerLink>
      </span>
    </nav>
  );
}
