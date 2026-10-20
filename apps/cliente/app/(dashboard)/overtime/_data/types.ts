import type { PeriodRange } from "../../_dashboard-kit/period";
import type { OvertimeBase } from "./engine";
import type { OvertimeFilters } from "./filters";

export type { OvertimeBase };

export interface FilterOption {
  value: string;
  label: string;
}

export interface RateKpi {
  /** Tasa en % (horas extra ÷ base). null = sin datos */
  value: number | null;
  prev: number | null;
  /** Tasa de los últimos 12 meses cubiertos, si hay al menos 6 */
  avg: number | null;
  /** Meta del tenant en % */
  target: number;
  /** Unidades (de la primera dimensión) con tasa sobre la meta y total de unidades con tasa */
  over: { count: number; total: number; dimension: string } | null;
}

export interface CountKpi {
  value: number;
  prev: number | null;
}

export interface Kpis {
  rate: RateKpi;
  hours: { value: number; prev: number | null };
  /** Personas con horas extra; pct sobre las personas con horas informadas en el período */
  people: CountKpi & { pct: number | null; covered: number };
  /** Horas extra por persona que hizo horas extra */
  perPerson: { value: number | null; prev: number | null };
}

export interface SeriesPoint {
  month: string;
  /** Tasa en %; null = mes sin cobertura de datos */
  rate: number | null;
  hours: number | null;
}

export interface TypeItem {
  key: string;
  label: string;
  hours: number;
  /** % de las horas del grupo (horas extra, o no autorizadas) */
  share: number;
  href?: string;
}

export interface UnitRateItem {
  key: string;
  label: string;
  /** Tasa en %; null si la unidad no tuvo base de cálculo */
  rate: number | null;
  hours: number;
  /** Base del período en la unidad (horas programadas o trabajadas) */
  base: number;
  /** Personas con horas informadas en el período */
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
}

export type OvertimeData =
  | { status: "empty"; hasPeople: boolean }
  | {
      status: "ok";
      period: PeriodRange;
      filters: OvertimeFilters;
      base: OvertimeBase;
      kpis: Kpis;
      series: SeriesPoint[];
      /** Horas extra por tipo (categoría hora extra) */
      byType: TypeItem[];
      /** Horas extra no autorizadas: dato de color, fuera de toda tasa. Vacío si el tenant no las carga */
      unauthorized: { items: TypeItem[]; hours: number };
      dimensions: DimensionData[];
      typeOptions: FilterOption[];
      /** Personas con horas informadas en el período sobre las personas con horas programadas */
      coverage: { covered: number; total: number };
      freshness: Freshness;
      notices: Notices;
    };

/** Una unidad con menos personas que esto se marca como muestra chica */
export const SMALL_SAMPLE = 3;
