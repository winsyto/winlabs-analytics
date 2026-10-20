"use client";

import { monthLabel } from "../../_dashboard-kit/format";
import { RateTrendChart } from "../../_dashboard-kit/rate-trend-chart";
import type { SeriesPoint } from "../_data/types";
import { fmtHours, fmtPct } from "./format";

/** Evolución mensual de la tasa de horas extra con la meta como línea de referencia. */
export function TrendChart({ series, target }: { series: SeriesPoint[]; target: number }) {
  return (
    <RateTrendChart
      series={series}
      target={target}
      fmtRate={fmtPct}
      rateName="tasa de horas extra"
      tooltipDetail={(p) => <p>Horas extra: {fmtHours(p.hours!)}</p>}
      table={{
        caption: "Evolución mensual de la tasa de horas extra",
        columns: ["Mes", "Tasa", "Horas extra"],
        rows: series.map((s) => [
          monthLabel(s.month),
          s.rate === null ? "sin datos" : fmtPct(s.rate),
          s.hours === null ? "—" : fmtHours(s.hours),
        ]),
      }}
    />
  );
}
