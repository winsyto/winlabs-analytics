/**
 * Paleta de los dashboards (D-147). Única fuente de los colores de gráficos y tendencias:
 * `paletteCss()` genera las variables CSS (`--wla-*`) y `PALETTES` sirve a los PDF, que no leen CSS.
 * Para cambiar de paleta alcanza con `DEFAULT_PALETTE` (o, a futuro, una preferencia del cliente
 * que setee `data-palette` en <html>). El ámbar (`target`) queda reservado a la meta.
 */
export type PaletteId = "a" | "b" | "c";

export interface Palette {
  name: string;
  /** Series de gráficos, en orden de uso; la última es el gris de «otros» */
  series: [string, string, string, string, string];
  good: string;
  bad: string;
  neutral: string;
  target: string;
}

export const PALETTES: Record<PaletteId, Palette> = {
  a: { name: "Azul sobrio", series: ["#1d4ed8", "#0e7490", "#6366f1", "#94a3b8", "#9ca3af"], good: "#15803d", bad: "#b91c1c", neutral: "#475569", target: "#b45309" },
  b: { name: "Verde azulado", series: ["#0f766e", "#4338ca", "#0369a1", "#a8a29e", "#9ca3af"], good: "#15803d", bad: "#b91c1c", neutral: "#57534e", target: "#b45309" },
  c: { name: "Categórica accesible", series: ["#0072b2", "#009e73", "#cc79a7", "#56b4e9", "#9ca3af"], good: "#117a5a", bad: "#b3261e", neutral: "#555b66", target: "#b45309" },
};

export const DEFAULT_PALETTE: PaletteId = "a";

/** Colores para props de gráficos (recharts): referencian las variables CSS de la paleta activa */
export const CHART = {
  s1: "var(--wla-series-1)",
  s2: "var(--wla-series-2)",
  s3: "var(--wla-series-3)",
  s4: "var(--wla-series-4)",
  s5: "var(--wla-series-5)",
  good: "var(--wla-good)",
  bad: "var(--wla-bad)",
  neutral: "var(--wla-neutral)",
  target: "var(--wla-target)",
} as const;

/** Series para gráficos con varias categorías (anillos), en orden */
export const CHART_SERIES = [CHART.s1, CHART.s2, CHART.s3, CHART.s4, CHART.s5] as const;

const vars = (p: Palette) =>
  [
    ...p.series.map((c, i) => `--wla-series-${i + 1}:${c}`),
    `--wla-good:${p.good}`,
    `--wla-bad:${p.bad}`,
    `--wla-neutral:${p.neutral}`,
    `--wla-target:${p.target}`,
  ].join(";");

/** CSS con las variables de todas las paletas; la activa se elige con `data-palette` en <html> */
export function paletteCss(): string {
  return (Object.keys(PALETTES) as PaletteId[]).map((id) => `[data-palette="${id}"]{${vars(PALETTES[id])}}`).join("");
}

/** Dirección favorable de un indicador: define de qué color se pinta su variación */
export type Polarity = "up-good" | "down-good" | "neutral";
export type Tone = "good" | "bad" | "neutral";

export function toneOf(polarity: Polarity, diff: number | null): Tone {
  if (diff === null || diff === 0 || polarity === "neutral") return "neutral";
  return (diff > 0) === (polarity === "up-good") ? "good" : "bad";
}
