import { z } from "zod";
import {
  activeDimensionCount,
  firstParam,
  parseDimensionFilters,
  type DimensionFilter,
} from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import type { PeriodKey } from "../../_dashboard-kit/period";

const periodSchema = z.enum(["month", "12m", "year"]).catch("month");
const TYPE_CODE = /^[A-Za-z0-9_]{1,50}$/;

export interface OvertimeFilters {
  p: PeriodKey;
  /** Selección por tipo de dimensión (clave = código del tipo). Solo contiene dimensiones con selección. */
  dims: Record<string, DimensionFilter>;
  /** Códigos de tipo de hora extra elegidos (vacío = todos) */
  types: string[];
}

const list = (v: string | string[] | undefined) =>
  (firstParam(v) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
  dimensions: Dimension[]
): OvertimeFilters {
  return {
    p: periodSchema.parse(firstParam(sp.p)),
    dims: parseDimensionFilters(sp, dimensions),
    types: [...new Set(list(sp.f_type).filter((t) => TYPE_CODE.test(t)))],
  };
}

export const activeFilterCount = (f: OvertimeFilters) => activeDimensionCount(f.dims) + f.types.length;

export const hasActiveFilters = (f: OvertimeFilters) => activeFilterCount(f) > 0;
