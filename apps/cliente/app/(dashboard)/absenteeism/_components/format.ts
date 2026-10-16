import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import type { AbsenceDisplay, Amount } from "../_data/types";

export const fmtPct = (n: number) => `${fmtDec(n)} %`;

/** Diferencia en puntos porcentuales con signo: "+0,8 pp" */
export function fmtPp(n: number): string {
  const v = Math.round(n * 10) / 10;
  if (v === 0) return "0,0 pp";
  return `${v > 0 ? "+" : "−"}${fmtDec(Math.abs(v))} pp`;
}

export const fmtHours = (n: number) => `${n >= 100 ? fmtInt(n) : fmtDec(n)} h`;
export const fmtDays = (n: number) => `${fmtDec(n)} ${Math.round(n * 10) / 10 === 1 ? "día" : "días"}`;

/** Cantidad principal según la preferencia del tenant (con "ambas" se muestran los días y las horas aparte). */
export function amountMain(a: Amount, display: AbsenceDisplay): string {
  return display === "hours" ? fmtHours(a.hours) : fmtDays(a.days);
}

export function amountFull(a: Amount, display: AbsenceDisplay): string {
  if (display === "hours") return fmtHours(a.hours);
  if (display === "days") return fmtDays(a.days);
  return `${fmtDays(a.days)} (${fmtHours(a.hours)})`;
}

/** Valor numérico que ordena y dimensiona los gráficos de cantidad */
export const amountValue = (a: Amount, display: AbsenceDisplay) => (display === "hours" ? a.hours : a.days);
