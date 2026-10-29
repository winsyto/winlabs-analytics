"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@wla/ui";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { monthLabel, monthShort } from "../../_dashboard-kit/format";
import { RateTrendChart } from "../../_dashboard-kit/rate-trend-chart";
import type { SeriesPoint } from "../_data/types";
import { fmtPct } from "./format";
import { CHART } from "../../_dashboard-kit/palette";

const TABS = ["Tasa mensual", "Ingresos y egresos"] as const;

/** Evolución de 12 meses con dos vistas: la tasa de rotación contra la meta mensual, y los ingresos contra los egresos. */
export function EvolutionPanel({ series, monthlyTarget, subtitle }: { series: SeriesPoint[]; monthlyTarget: number; subtitle: string }) {
  const [tab, setTab] = useState(0);
  const data = series.map((s) => ({ ...s, label: monthShort(s.month) }));

  return (
    <section className="flex min-h-0 flex-col rounded-lg border bg-card p-3 lg:col-span-2">
      <header className="mb-1 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Vista de la evolución" className="flex gap-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`evo-tab-${i}`}
              aria-selected={i === tab}
              aria-controls="evo-tabpanel"
              onClick={() => setTab(i)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                i === tab ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </header>
      <div id="evo-tabpanel" role="tabpanel" aria-labelledby={`evo-tab-${tab}`} className="relative h-60 min-h-0 lg:h-auto lg:flex-1">
        <div className="absolute inset-0">
          {tab === 0 ? (
            <RateTrendChart
              series={series}
              target={monthlyTarget}
              fmtRate={fmtPct}
              rateName="rotación mensual"
              curve="linear"
              tooltipDetail={(p) => <p>Bajas: {p.bajas}</p>}
              table={{
                caption: "Evolución mensual de la rotación",
                columns: ["Mes", "Rotación", "Bajas"],
                rows: series.map((s) => [monthLabel(s.month), s.rate === null ? "sin datos" : fmtPct(s.rate), s.bajas]),
              }}
            />
          ) : (
            <figure className="h-full w-full">
              <figcaption className="sr-only">
                {`Ingresos y egresos por mes: ${series.map((s) => `${monthLabel(s.month)} ${s.altas} ingresos, ${s.bajas} egresos`).join("; ")}.`}
              </figcaption>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 18, right: 16, bottom: 0, left: -8 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="#e2e5e0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    content={({ active, payload }) => {
                      const p = active ? (payload?.[0]?.payload as (SeriesPoint & { label: string }) | undefined) : null;
                      if (!p) return null;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <p className="mb-1 font-semibold">{monthLabel(p.month, "long")}</p>
                          <p>Ingresos: {p.altas}</p>
                          <p>Egresos: {p.bajas}</p>
                          <p>Neto: {p.altas - p.bajas > 0 ? "+" : ""}{p.altas - p.bajas}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend verticalAlign="top" align="right" height={20} iconType="square" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="altas" name="Ingresos" fill={CHART.s2} radius={[2, 2, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="altas" position="top" fontSize={10} fill="#374151" />
                  </Bar>
                  <Bar dataKey="bajas" name="Egresos" fill={CHART.s1} radius={[2, 2, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="bajas" position="top" fontSize={10} fill="#374151" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <ChartDataTable
                caption="Ingresos y egresos por mes"
                columns={["Mes", "Ingresos", "Egresos"]}
                rows={series.map((s) => [monthLabel(s.month), s.altas, s.bajas])}
              />
            </figure>
          )}
        </div>
      </div>
    </section>
  );
}
