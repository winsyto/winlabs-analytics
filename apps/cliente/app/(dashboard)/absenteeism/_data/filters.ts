import { z } from "zod";
import { ABSENTEEISM_CLASSES } from "@wla/db";
import {
  activeDimensionCount,
  firstParam,
  parseDimensionFilters,
  type DimensionFilter,
} from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import type { PeriodKey } from "../../_dashboard-kit/period";

const periodSchema = z.enum(["month", "12m", "year"]).catch("month");
const CLASS_CODES: readonly string[] = ABSENTEEISM_CLASSES.map((c) => c.code);
const TYPE_CODE = /^[A-Za-z0-9_]{1,50}$/;

export interface AbsenteeismFilters {
  p: PeriodKey;
  /** Selección por tipo de dimensión (clave = código del tipo). Solo contiene dimensiones con selección. */
  dims: Record<string, DimensionFilter>;
  /** Clases de ausencia elegidas (vacío = todas) */
  classes: string[];
  /** Códigos de tipo de ausencia elegidos (vacío = todos) */
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
): AbsenteeismFilters {
  return {
    p: periodSchema.parse(firstParam(sp.p)),
    dims: parseDimensionFilters(sp, dimensions),
    classes: [...new Set(list(sp.f_class).filter((c) => CLASS_CODES.includes(c)))],
    types: [...new Set(list(sp.f_type).filter((t) => TYPE_CODE.test(t)))],
  };
}

export const activeFilterCount = (f: AbsenteeismFilters) =>
  activeDimensionCount(f.dims) + f.classes.length + f.types.length;

export const hasActiveFilters = (f: AbsenteeismFilters) => activeFilterCount(f) > 0;

export const CLASS_LABELS: Record<string, string> = Object.fromEntries(
  ABSENTEEISM_CLASSES.map((c) => [c.code, c.name])
);
