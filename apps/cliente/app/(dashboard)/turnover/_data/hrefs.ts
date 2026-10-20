import { filterTokens } from "../../_dashboard-kit/dimension-filters";
import type { TurnoverFilters } from "./filters";

export type DetailScope = "bajas" | "tempranas" | "categoria" | "motivo" | "dim";

/** Parámetros de URL que representan período y filtros (el estado completo vive en la URL). */
export function filtersQuery(f: TurnoverFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.p !== "month") p.set("p", f.p);
  for (const [code, sel] of Object.entries(f.dims)) {
    const tokens = filterTokens(sel);
    if (tokens.length) p.set(`f_${code.toLowerCase()}`, tokens.join(","));
  }
  if (f.categories.length) p.set("f_cat", f.categories.join(","));
  if (f.reasons.length) p.set("f_reason", f.reasons.join(","));
  return p;
}

const withQs = (path: string, qs: URLSearchParams) => {
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
};

export const overviewHref = (f: TurnoverFilters) => withQs("/turnover", filtersQuery(f));

/**
 * /turnover/<scope>[/<segmento>...] conservando período y filtros.
 * Para una dimensión: ("dim", slug, idUnidad | "none"); para una categoría o un motivo: ("categoria" | "motivo", código).
 */
export function detailHref(f: TurnoverFilters, scope: DetailScope, ...segments: string[]): string {
  const path = `/turnover/${scope}${segments.map((s) => `/${encodeURIComponent(s)}`).join("")}`;
  return withQs(path, filtersQuery(f));
}
