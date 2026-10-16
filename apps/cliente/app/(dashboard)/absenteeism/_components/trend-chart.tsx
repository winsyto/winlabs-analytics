"use client";

import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtDec, monthLabel, monthShort } from "../../_dashboard-kit/format";
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
  const data = series.map((s) => ({ ...s, label: monthShort(s.month) }));
  const known = series.filter((s) => s.rate !== null);
  const first = known[0];
  const last = known[known.length - 1];
  const max = Math.max(target, ...known.map((s) => s.rate ?? 0));

  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {first && last
          ? `Tasa de ausentismo de ${monthLabel(first.month)} a ${monthLabel(last.month)}: de ${fmtPct(first.rate!)} a ${fmtPct(last.rate!)}. Meta: ${fmtPct(target)}.`
          : "Sin datos de ausentismo en el rango."}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="#e2e5e0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, Math.ceil(max * 1.25 * 2) / 2]}
            tickFormatter={(v: number) => `${fmtDec(v)}`}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ReferenceLine
            y={target}
            stroke="#b45309"
            strokeDasharray="5 4"
            label={{ value: `Meta ${fmtPct(target)}`, position: "insideTopRight", fontSize: 10, fill: "#b45309" }}
          />
          <Tooltip
            cursor={{ stroke: "#9ca3af", strokeDasharray: 3 }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold">{monthLabel(p.month, "long")}</p>
                  <p>
                    Tasa: <strong>{p.rate === null ? "sin datos" : fmtPct(p.rate)}</strong>
                  </p>
                  {p.rate !== null && (
                    <p>
                      Ausencia:{" "}
                      {display === "hours"
                        ? fmtHours(p.hours)
                        : display === "days"
                          ? fmtDays(p.days)
                          : `${fmtDays(p.days)} (${fmtHours(p.hours)})`}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#1e2530"
            strokeWidth={2}
            dot={{ r: 3, fill: "#1e2530" }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="rate"
              position="top"
              fontSize={10}
              fill="#374151"
              formatter={(v: unknown) => (typeof v === "number" ? fmtDec(v) : "")}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption="Evolución mensual de la tasa de ausentismo"
        columns={["Mes", "Tasa", "Horas", "Días"]}
        rows={series.map((s) => [
          monthLabel(s.month),
          s.rate === null ? "sin datos" : fmtPct(s.rate),
          s.hours === null ? "—" : fmtHours(s.hours),
          s.days === null ? "—" : fmtDays(s.days),
        ])}
      />
    </figure>
  );
}
