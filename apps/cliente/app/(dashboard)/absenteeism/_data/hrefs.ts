import { filterTokens } from "../../_dashboard-kit/dimension-filters";
import type { AbsenteeismFilters } from "./filters";

export type DetailScope = "eventos" | "personas" | "clase" | "tipo" | "dim";

/** Parámetros de URL que representan período y filtros (el estado completo vive en la URL). */
export function filtersQuery(f: AbsenteeismFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.p !== "month") p.set("p", f.p);
  for (const [code, sel] of Object.entries(f.dims)) {
    const tokens = filterTokens(sel);
    if (tokens.length) p.set(`f_${code.toLowerCase()}`, tokens.join(","));
  }
  if (f.classes.length) p.set("f_class", f.classes.join(","));
  if (f.types.length) p.set("f_type", f.types.join(","));
  return p;
}

const withQs = (path: string, qs: URLSearchParams) => {
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
};

export const overviewHref = (f: AbsenteeismFilters) => withQs("/absenteeism", filtersQuery(f));

/**
 * /absenteeism/<scope>[/<segmento>...] conservando período y filtros.
 * Para una dimensión: ("dim", slug, idUnidad | "none"); para clase o tipo: ("clase" | "tipo", código).
 */
export function detailHref(f: AbsenteeismFilters, scope: DetailScope, ...segments: string[]): string {
  const path = `/absenteeism/${scope}${segments.map((s) => `/${encodeURIComponent(s)}`).join("")}`;
  return withQs(path, filtersQuery(f));
}
