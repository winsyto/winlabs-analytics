const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const intFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtInt = (n: number) => intFmt.format(n);
export const fmtDec = (n: number) => decFmt.format(n);

export function fmtSigned(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${intFmt.format(Math.abs(n))}`;
}

export function fmtSignedPct(n: number): string {
  if (n === 0) return "0,0%";
  return `${n > 0 ? "+" : "−"}${decFmt.format(Math.abs(n))}%`;
}

/** ymd = "YYYY-MM-DD". Devuelve p. ej. "sep 2026" o "septiembre 2026". */
export function monthLabel(ymd: string, style: "short" | "long" = "short"): string {
  const y = ymd.slice(0, 4);
  const m = Number(ymd.slice(5, 7)) - 1;
  return `${(style === "short" ? MONTHS_SHORT : MONTHS_LONG)[m]} ${y}`;
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" */
export function fmtDate(ymd: string | null): string {
  return ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : "—";
}

export function fmtTenure(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} m`;
  return m === 0 ? `${y} a` : `${y} a ${m} m`;
}

export function monthShort(ymd: string): string {
  const m = Number(ymd.slice(5, 7)) - 1;
  return `${MONTHS_SHORT[m]} ${ymd.slice(2, 4)}`;
}
