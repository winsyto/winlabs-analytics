import type { PeriodRange } from "../../_dashboard-kit/period";
import type { PayrollFilters } from "./filters";

export interface FilterOption {
  value: string;
  label: string;
}

/** Valor de un indicador de importe: null = sin datos (o no se puede mostrar) */
export interface MoneyKpi {
  value: number | null;
  prev: number | null;
  /** Referencia: promedio de los últimos 12 meses llevado al largo del período (si hay al menos 6 meses) */
  avg: number | null;
}

export interface Kpis {
  /** Masa salarial bruta: el acumulador marcado como bruto o, si no hay, la suma de las clases de haber */
  gross: MoneyKpi & { viaClasses: boolean };
  /** Costo medio mensual por persona = masa bruta ÷ personas-mes pagadas */
  perPerson: MoneyKpi & { avgPersons: number | null };
  /** Neto pagado: el acumulador marcado como neto. null = no hay acumulador de neto */
  net: MoneyKpi;
  /** Importe de la clase "Horas extra" y su peso sobre la clase "Sueldo" */
  overtime: { value: number | null; prev: number | null; pctOfSalary: number | null; hasClass: boolean; classId: number | null };
}

export type SeriesState = "ok" | "nodata" | "hidden";

export interface SeriesPoint {
  month: string;
  state: SeriesState;
  gross: number | null;
  net: number | null;
  persons: number;
}

export interface ClassItem {
  /** id de la clase, o "uncl" para los conceptos sin clasificar */
  key: string;
  label: string;
  side: "earning" | "deduction" | "unclassified";
  /** Importe del período con el signo de origen */
  amount: number;
  /** % sobre el total de haberes clasificados (en valor absoluto) */
  share: number;
  href?: string;
}

export interface Composition {
  earnings: ClassItem[];
  deductions: ClassItem[];
  unclassified: ClassItem | null;
  /** Total de haberes de las clases (base de los porcentajes) */
  earningsTotal: number;
}

export interface UnitCostItem {
  key: string;
  label: string;
  /** Costo medio mensual por persona; null si la unidad tiene menos de MIN_PERSONS personas */
  cost: number | null;
  /** Masa bruta de la unidad (null si está reservada por privacidad) */
  total: number | null;
  persons: number;
  /** Menos de MIN_PERSONS personas: el importe no se muestra */
  hidden: boolean;
  href?: string;
}

export interface DimensionData {
  code: string;
  name: string;
  slug: string;
  items: UnitCostItem[];
  options: FilterOption[];
}

export interface Freshness {
  refMonth: string;
  firstMonth: string;
  staleDays: number;
  isStale: boolean;
  /** El período empieza antes del primer mes con liquidaciones: los números cubren solo desde partialFrom */
  partialFrom: string | null;
  comparisonAvailable: boolean;
  /** Falta marcar qué acumulador es el sueldo bruto / el neto */
  missingGross: boolean;
  missingNet: boolean;
  /** Conceptos con importes todavía sin clasificar */
  unclassifiedConcepts: number;
}

export type PayrollData =
  | { status: "empty"; hasConcepts: boolean }
  | {
      status: "ok";
      period: PeriodRange;
      filters: PayrollFilters;
      currency: string;
      kpis: Kpis;
      series: SeriesPoint[];
      composition: Composition;
      dimensions: DimensionData[];
      /** El período tiene menos de MIN_PERSONS personas pagadas por mes: no se muestran importes */
      restricted: boolean;
      /** Meses del período con liquidaciones */
      coveredMonths: number;
      freshness: Freshness;
    };

/** Una celda con menos personas que esto no muestra importes (privacidad) */
export const MIN_PERSONS = 3;
