import type { PeriodRange } from "../../_dashboard-kit/period";
import type { TurnoverFilters } from "./filters";

export interface FilterOption {
  value: string;
  label: string;
}

/** Tasa de rotación del período contra la meta prorrateada (la meta del tenant es anual) */
export interface RateKpi {
  /** Tasa en % (bajas ÷ headcount promedio). null = sin datos */
  value: number | null;
  prev: number | null;
  /** Tasa mensual promedio de los últimos 12 meses llevada al largo del período, si hay al menos 6 meses */
  avg: number | null;
}

export interface Kpis {
  /** Rotación total y meta prorrateada al período (la meta anual × meses ÷ 12) */
  rate: RateKpi & {
    target: number;
    annualTarget: number;
    months: number;
    over: { count: number; total: number; dimension: string } | null;
  };
  /** Rotación de las bajas de categoría voluntaria */
  voluntary: RateKpi;
  bajas: { value: number; prev: number | null; byCategory: { label: string; count: number }[] };
  /** Bajas con menos de 12 meses de antigüedad */
  early: { value: number; prev: number | null; pct: number | null; avgTenureMonths: number | null };
}

export interface SeriesPoint {
  month: string;
  /** Tasa mensual en %; null = mes sin apertura o sin cierre */
  rate: number | null;
  altas: number;
  bajas: number;
}

export interface ReasonItem {
  key: string;
  label: string;
  count: number;
  /** % de las bajas del período */
  share: number;
  href?: string;
}

export interface UnitRateItem {
  key: string;
  label: string;
  /** Tasa en %; null si la unidad no tuvo headcount en el período */
  rate: number | null;
  bajas: number;
  /** Headcount promedio de la unidad en el período */
  avgHeadcount: number;
  /** Muestra chica: headcount promedio menor a SMALL_SAMPLE */
  small: boolean;
  href?: string;
}

export interface DimensionData {
  code: string;
  name: string;
  slug: string;
  items: UnitRateItem[];
  options: FilterOption[];
}

export interface Freshness {
  refMonth: string;
  firstMonth: string;
  staleDays: number;
  isStale: boolean;
  /** El período empieza antes del primer mes con apertura: los números cubren solo desde partialFrom */
  partialFrom: string | null;
  comparisonAvailable: boolean;
}

export type TurnoverData =
  | { status: "empty"; hasPeople: boolean; needsHistory: boolean }
  | {
      status: "ok";
      period: PeriodRange;
      filters: TurnoverFilters;
      kpis: Kpis;
      series: SeriesPoint[];
      byCategory: ReasonItem[];
      byReason: ReasonItem[];
      dimensions: DimensionData[];
      categoryOptions: FilterOption[];
      reasonOptions: FilterOption[];
      /** Headcount promedio del período, sobre el que se calcula la tasa */
      avgHeadcount: number | null;
      freshness: Freshness;
    };

/** Una unidad con un headcount promedio menor a esto se marca como muestra chica */
export const SMALL_SAMPLE = 3;
