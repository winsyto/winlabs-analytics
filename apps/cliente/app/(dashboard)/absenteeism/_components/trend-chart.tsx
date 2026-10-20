"use client";

import { RateTrendChart } from "../../_dashboard-kit/rate-trend-chart";
import { monthLabel } from "../../_dashboard-kit/format";
import type { AbsenceDisplay, SeriesPoint } from "../_data/types";
import { fmtDays, fmtHours, fmtPct } from "./format";

/** Evolución mensual de la tasa de ausentismo con la meta como línea de referencia. */
export function TrendChart({
  series,
  target,
  display,
}: {
  series: SeriesPoint[];
  target: number;
  display: AbsenceDisplay;
}) {
  return (
    <RateTrendChart
      series={series}
      target={target}
      fmtRate={fmtPct}
      rateName="tasa de ausentismo"
      tooltipDetail={(p) => (
        <p>
          Ausencia:{" "}
          {display === "hours"
            ? fmtHours(p.hours!)
            : display === "days"
              ? fmtDays(p.days!)
              : `${fmtDays(p.days!)} (${fmtHours(p.hours!)})`}
        </p>
      )}
      table={{
        caption: "Evolución mensual de la tasa de ausentismo",
        columns: ["Mes", "Tasa", "Horas", "Días"],
        rows: series.map((s) => [
          monthLabel(s.month),
          s.rate === null ? "sin datos" : fmtPct(s.rate),
          s.hours === null ? "—" : fmtHours(s.hours),
          s.days === null ? "—" : fmtDays(s.days),
        ]),
      }}
    />
  );
}
