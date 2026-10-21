/** Formato de importes en la moneda del tenant (código ISO). Sin decimales: son masas salariales. */
function money(currency: string, compact: boolean): Intl.NumberFormat {
  const compactOpts = compact ? { notation: "compact" as const } : {};
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      ...compactOpts,
    });
  } catch {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: compact ? 1 : 0, ...compactOpts });
  }
}

/** "$ 1.234.567" */
export const fmtMoney = (n: number, currency: string) => money(currency, false).format(n);

/** "$ 1,2 M": para ejes y etiquetas de gráficos */
export const fmtMoneyCompact = (n: number, currency: string) => money(currency, true).format(n);

/** Diferencia con signo: "+$ 12.345" */
export function fmtMoneyDiff(n: number, currency: string): string {
  if (n === 0) return fmtMoney(0, currency);
  return `${n > 0 ? "+" : "−"}${fmtMoney(Math.abs(n), currency)}`;
}

/** Porcentaje con una decimal: "6,9 %" */
export const fmtShare = (n: number) =>
  `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)} %`;
