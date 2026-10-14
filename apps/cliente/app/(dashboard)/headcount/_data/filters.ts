import { z } from "zod";
import type { Dimension } from "./dimensions";
import type { PeriodKey } from "./period";

/** Valor especial del filtro: personas sin unidad de esa dimensión */
export const NONE_TOKEN = "none";

const tokenList = z
  .string()
  .optional()
  .transform((s) => {
    const parts = s ? s.split(",") : [];
    return {
      none: parts.includes(NONE_TOKEN),
      ids: parts
        .filter((x) => x !== NONE_TOKEN)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 200),
    };
  });

const periodSchema = z.enum(["month", "12m", "year"]).catch("month");

/** Selección de una dimensión: unidades elegidas y/o "Sin asignar". Dentro de una dimensión es OR. */
export interface DimensionFilter {
  ids: number[];
  none: boolean;
}

export interface HeadcountFilters {
  p: PeriodKey;
  /** Selección por tipo de dimensión (clave = código del tipo). Solo contiene dimensiones con selección. */
  dims: Record<string, DimensionFilter>;
}

/** Valores seleccionados como los usa el selector: "none" más ids de unidad */
export const filterTokens = (f?: DimensionFilter): string[] =>
  f ? [...(f.none ? [NONE_TOKEN] : []), ...f.ids.map(String)] : [];

/** Nombre del parámetro de URL de una dimensión: f_<tipo en minúsculas> */
export const filterParam = (dim: Pick<Dimension, "slug">) => `f_${dim.slug}`;

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
  dimensions: Dimension[]
): HeadcountFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dims: Record<string, DimensionFilter> = {};
  for (const d of dimensions) {
    const parsed = tokenList.parse(first(sp[filterParam(d)]));
    if (parsed.ids.length > 0 || parsed.none) dims[d.code] = parsed;
  }
  return { p: periodSchema.parse(first(sp.p)), dims };
}

export const activeFilterCount = (f: HeadcountFilters) =>
  Object.values(f.dims).reduce((s, d) => s + d.ids.length + (d.none ? 1 : 0), 0);

export const hasActiveFilters = (f: HeadcountFilters) => activeFilterCount(f) > 0;
