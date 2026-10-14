import type { HeadcountFilters } from "./filters";
import type { PeriodRange } from "./period";

export interface KpiValue {
  value: number | null;
  prev: number | null;
  avg: number | null;
  avgLabel: string;
}

export interface DistItem {
  key: string;
  label: string;
  value: number;
  href?: string;
}

export interface SeriesPoint {
  month: string;
  headcount: number | null;
  altas: number;
  bajas: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

/** Una dimensión del dashboard con su distribución al cierre y las unidades disponibles para filtrar. */
export interface DimensionData {
  code: string;
  name: string;
  slug: string;
  items: DistItem[];
  options: FilterOption[];
}

export interface Freshness {
  refMonth: string;
  firstMonth: string;
  staleDays: number;
  isStale: boolean;
  hasGaps: boolean;
  comparisonAvailable: boolean;
}

export type HeadcountData =
  | { status: "empty" }
  | {
      status: "ok";
      period: PeriodRange;
      filters: HeadcountFilters;
      kpis: { headcount: KpiValue; altas: KpiValue; bajas: KpiValue; neta: KpiValue };
      series: SeriesPoint[];
      dimensions: DimensionData[];
      freshness: Freshness;
    };
