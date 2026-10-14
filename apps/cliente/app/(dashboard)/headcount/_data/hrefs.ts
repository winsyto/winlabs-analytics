import { filterTokens, type HeadcountFilters } from "./filters";

export type DetailScope = "activos" | "altas" | "bajas" | "dim";

export function filtersQuery(f: HeadcountFilters): URLSearchParams {
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

export const overviewHref = (f: HeadcountFilters) => withQs("/headcount", filtersQuery(f));

/** /headcount/<scope>[/<segmento>...] conservando período y filtros. Para una dimensión: ("dim", slug, idUnidad | "none"). */
export function detailHref(f: HeadcountFilters, scope: DetailScope, ...segments: string[]): string {
  const path = `/headcount/${scope}${segments.map((s) => `/${encodeURIComponent(s)}`).join("")}`;
  return withQs(path, filtersQuery(f));
}
