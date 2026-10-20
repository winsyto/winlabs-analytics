import { fmtDec, fmtHours, fmtPct, fmtPp } from "../../_dashboard-kit/format";
import type { AbsenceDisplay, Amount } from "../_data/types";

export { fmtPct, fmtPp, fmtHours };

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
