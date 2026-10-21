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

export interface PayrollFilters {
  p: PeriodKey;
  /** Selección por tipo de dimensión (clave = código del tipo). Solo contiene dimensiones con selección. */
  dims: Record<string, DimensionFilter>;
}

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
  dimensions: Dimension[]
): PayrollFilters {
  return {
    p: periodSchema.parse(firstParam(sp.p)),
    dims: parseDimensionFilters(sp, dimensions),
  };
}

export const activeFilterCount = (f: PayrollFilters) => activeDimensionCount(f.dims);
export const hasActiveFilters = (f: PayrollFilters) => activeFilterCount(f) > 0;
