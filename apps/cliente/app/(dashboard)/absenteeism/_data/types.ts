import type { PeriodRange } from "../../_dashboard-kit/period";
import type { AbsenteeismFilters } from "./filters";

export type AbsenceDisplay = "hours" | "days" | "both";

export interface FilterOption {
  value: string;
  label: string;
}

/** Cantidad de ausencia: horas y días efectivos (días = horas ÷ horas diarias de cada turno) */
export interface Amount {
  hours: number;
  days: number;
}

export interface RateKpi {
  /** Tasa en % (horas ausentes ÷ horas programadas). null = sin datos */
  value: number | null;
  prev: number | null;
  /** Tasa de los últimos 12 meses cubiertos, si hay al menos 6 */
  avg: number | null;
  /** Meta del tenant en % */
  target: number;
}

export interface CountKpi {
  value: number;
  prev: number | null;
}

export interface Kpis {
  rate: RateKpi;
  absence: { cur: Amount; prev: Amount | null };
  events: CountKpi & { avgDays: number | null };
  people: CountKpi & { pct: number | null; exposed: number };
}

export interface SeriesPoint {
  month: string;
  /** Tasa en %; null = mes sin cobertura de datos */
  rate: number | null;
  hours: number | null;
  days: number | null;
}

export interface BreakdownItem {
  key: string;
  label: string;
  hours: number;
  days: number;
  events: number;
  /** % de la ausencia del período */
  share: number;
  href?: string;
}

export interface UnitRateItem {
  key: string;
  label: string;
  /** Tasa en %; null si la unidad no tuvo horas programadas */
  rate: number | null;
  hours: number;
  days: number;
  /** Horas programadas del período en la unidad */
  sched: number;
  /** Personas con horas programadas en el período */
  people: number;
  /** Muestra chica: menos de SMALL_SAMPLE personas */
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
  lastLoad: string | null;
  staleDays: number;
  isStale: boolean;
  /** El período empieza antes del primer mes con datos: los números cubren solo desde firstMonth */
  partialFrom: string | null;
  comparisonAvailable: boolean;
}

export interface Notices {
  unclassifiedTypes: number;
  attendanceMode: "basic" | "detailed";
}

export type AbsenteeismData =
  | { status: "empty"; hasPeople: boolean }
  | {
      status: "ok";
      period: PeriodRange;
      filters: AbsenteeismFilters;
      display: AbsenceDisplay;
      kpis: Kpis;
      series: SeriesPoint[];
      byClass: BreakdownItem[];
      byType: BreakdownItem[];
      /** Vacaciones, licencias de ley y francos: fuera de la tasa */
      excluded: { items: BreakdownItem[]; total: Amount };
      dimensions: DimensionData[];
      classOptions: FilterOption[];
      typeOptions: FilterOption[];
      freshness: Freshness;
      notices: Notices;
    };

/** Una unidad con menos personas que esto se marca como muestra chica */
export const SMALL_SAMPLE = 3;
