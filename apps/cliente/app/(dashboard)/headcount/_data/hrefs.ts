import type { HeadcountFilters } from "./filters";

export type DetailScope = "activos" | "altas" | "bajas" | "dim";

export function filtersQuery(f: HeadcountFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.p !== "month") p.set("p", f.p);
  for (const [code, ids] of Object.entries(f.dims)) {
    if (ids.length) p.set(`f_${code.toLowerCase()}`, ids.join(","));
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
