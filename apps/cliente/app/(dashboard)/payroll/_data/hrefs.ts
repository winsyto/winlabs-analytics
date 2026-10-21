import { filterTokens } from "../../_dashboard-kit/dimension-filters";
import type { PayrollFilters } from "./filters";

export type DetailScope = "procesos" | "clase" | "dim" | "personas";

/** Parámetros de URL que representan período y filtros (el estado completo vive en la URL). */
export function filtersQuery(f: PayrollFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.p !== "month") p.set("p", f.p);
  for (const [code, sel] of Object.entries(f.dims)) {
    const tokens = filterTokens(sel);
    if (tokens.length) p.set(`f_${code.toLowerCase()}`, tokens.join(","));
  }
  return p;
}

const withQs = (path: string, qs: URLSearchParams) => {
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
};

export const overviewHref = (f: PayrollFilters) => withQs("/payroll", filtersQuery(f));

/**
 * /payroll/<scope>[/<segmento>...] conservando período y filtros.
 * Para una clase: ("clase", id de clase | "uncl"); para una dimensión: ("dim", slug, idUnidad | "none").
 */
export function detailHref(f: PayrollFilters, scope: DetailScope, ...segments: string[]): string {
  const path = `/payroll/${scope}${segments.map((s) => `/${encodeURIComponent(s)}`).join("")}`;
  return withQs(path, filtersQuery(f));
}
