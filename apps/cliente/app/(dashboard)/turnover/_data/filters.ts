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
const REASON_CODE = /^[A-Za-z0-9_]{1,50}$/;

/** Categorías de motivo de baja (cfg_termination_reasons.category) con su nombre en pantalla. */
export const CATEGORY_LABELS: Record<string, string> = {
  voluntary: "Voluntaria",
  involuntary: "Involuntaria",
  end_of_contract: "Fin de contrato",
  retirement: "Jubilación",
  other: "Otra",
};
/** Bajas con un motivo que no figura en el catálogo o sin motivo */
export const UNSPECIFIED_LABEL = "Sin motivo";
export const CATEGORY_CODES = Object.keys(CATEGORY_LABELS);

export interface TurnoverFilters {
  p: PeriodKey;
  /** Selección por tipo de dimensión (clave = código del tipo). Solo contiene dimensiones con selección. */
  dims: Record<string, DimensionFilter>;
  /** Categorías de baja elegidas (vacío = todas) */
  categories: string[];
  /** Códigos de motivo de baja elegidos (vacío = todos) */
  reasons: string[];
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
): TurnoverFilters {
  return {
    p: periodSchema.parse(firstParam(sp.p)),
    dims: parseDimensionFilters(sp, dimensions),
    categories: [...new Set(list(sp.f_cat).filter((c) => CATEGORY_CODES.includes(c)))],
    reasons: [...new Set(list(sp.f_reason).filter((r) => REASON_CODE.test(r)))],
  };
}

export const activeFilterCount = (f: TurnoverFilters) =>
  activeDimensionCount(f.dims) + f.categories.length + f.reasons.length;

export const hasActiveFilters = (f: TurnoverFilters) => activeFilterCount(f) > 0;
