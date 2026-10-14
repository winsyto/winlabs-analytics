import { z } from "zod";
import type { Dimension } from "./dimensions";
import type { PeriodKey } from "./period";

const idList = z
  .string()
  .optional()
  .transform((s) =>
    s
      ? s
          .split(",")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
          .slice(0, 200)
      : []
  );

const periodSchema = z.enum(["month", "12m", "year"]).catch("month");

export interface HeadcountFilters {
  p: PeriodKey;
  /** Unidades seleccionadas por tipo de dimensión (clave = código del tipo) */
  dims: Record<string, number[]>;
}

/** Nombre del parámetro de URL de una dimensión: f_<tipo en minúsculas> */
export const filterParam = (dim: Pick<Dimension, "slug">) => `f_${dim.slug}`;

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
  dimensions: Dimension[]
): HeadcountFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dims: Record<string, number[]> = {};
  for (const d of dimensions) {
    const ids = idList.parse(first(sp[filterParam(d)]));
    if (ids.length > 0) dims[d.code] = ids;
  }
  return { p: periodSchema.parse(first(sp.p)), dims };
}

export const activeFilterCount = (f: HeadcountFilters) =>
  Object.values(f.dims).reduce((s, ids) => s + ids.length, 0);

export const hasActiveFilters = (f: HeadcountFilters) => activeFilterCount(f) > 0;
