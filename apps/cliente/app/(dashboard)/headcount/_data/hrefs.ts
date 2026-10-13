import type { HeadcountFilters } from "./filters";

export type DetailScope = "activos" | "altas" | "bajas" | "area" | "sede" | "contrato";

export function filtersQuery(f: HeadcountFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.p !== "month") p.set("p", f.p);
  if (f.area.length) p.set("area", f.area.join(","));
  if (f.loc.length) p.set("loc", f.loc.join(","));
  if (f.pos.length) p.set("pos", f.pos.join(","));
  if (f.ct.length) p.set("ct", f.ct.join(","));
  return p;
}

const withQs = (path: string, qs: URLSearchParams) => {
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
};

export const overviewHref = (f: HeadcountFilters) => withQs("/headcount", filtersQuery(f));

export function detailHref(f: HeadcountFilters, scope: DetailScope, id?: string): string {
  const path = `/headcount/${scope}${id ? `/${encodeURIComponent(id)}` : ""}`;
  return withQs(path, filtersQuery(f));
}
