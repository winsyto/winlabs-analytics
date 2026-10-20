import { monthLabel } from "./format";

export type PeriodKey = "month" | "12m" | "year";

export interface PeriodRange {
  key: PeriodKey;
  /** Último mes con snapshot (YYYY-MM-01) */
  refMonth: string;
  /** Primer día del primer mes del período */
  start: string;
  /** Último día de refMonth */
  end: string;
  prevStart: string;
  prevEnd: string;
  prevRefMonth: string;
  months: number;
  label: string;
  compareLabel: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ymd -> "YYYY-MM-01" desplazado n meses */
export function addMonths(ymd: string, n: number): string {
  const total = Number(ymd.slice(0, 4)) * 12 + (Number(ymd.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

/** Primer día del último mes calendario cerrado (el mes anterior al actual, UTC). */
export function lastClosedMonth(now: Date = new Date()): string {
  const first = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`;
  return addMonths(first, -1);
}

export function monthEnd(ymd: string): string {
  const next = addMonths(ymd, 1);
  const d = new Date(`${next}T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function buildPeriod(key: PeriodKey, refMonth: string): PeriodRange {
  const end = monthEnd(refMonth);
  const prevRefMonth = key === "month" ? addMonths(refMonth, -1) : addMonths(refMonth, -12);

  let start: string;
  let months: number;
  if (key === "month") {
    start = refMonth;
    months = 1;
  } else if (key === "12m") {
    start = addMonths(refMonth, -11);
    months = 12;
  } else {
    start = `${refMonth.slice(0, 4)}-01-01`;
    months = Number(refMonth.slice(5, 7));
  }

  const prevStart = key === "month" ? prevRefMonth : addMonths(start, -12);
  const prevEnd = monthEnd(prevRefMonth);

  const label =
    key === "month"
      ? monthLabel(refMonth, "long")
      : `${monthLabel(start)} – ${monthLabel(refMonth)}`;
  const compareLabel =
    key === "month"
      ? `vs ${monthLabel(prevRefMonth, "long")}`
      : `vs ${monthLabel(prevStart)} – ${monthLabel(prevRefMonth)}`;

  return { key, refMonth, start, end, prevStart, prevEnd, prevRefMonth, months, label, compareLabel };
}
