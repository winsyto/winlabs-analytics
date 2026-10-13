"use client";

import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtInt, monthLabel, monthShort } from "../../_dashboard-kit/format";
import type { SeriesPoint } from "../_data/types";

export function EvolutionChart({ series }: { series: SeriesPoint[] }) {
  const data = series.map((s) => ({ ...s, label: monthShort(s.month) }));
  const known = series.filter((s) => s.headcount !== null);
  const first = known[0];
  const last = known[known.length - 1];

  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {first && last
          ? `Headcount de ${monthLabel(first.month)} a ${monthLabel(last.month)}: de ${first.headcount} a ${last.headcount} personas.`
          : "Sin datos de headcount en el rango."}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="#e2e5e0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            allowDecimals={false}
            domain={[(min: number) => Math.max(0, Math.floor(min * 0.9)), (max: number) => Math.ceil(max * 1.08)]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "#9ca3af", strokeDasharray: 3 }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold">{monthLabel(p.month, "long")}</p>
                  <p>Headcount: <strong>{p.headcount === null ? "sin dato" : fmtInt(p.headcount)}</strong></p>
                  <p>Altas: {fmtInt(p.altas)}</p>
                  <p>Bajas: {fmtInt(p.bajas)}</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="headcount"
            stroke="#1e2530"
            strokeWidth={2}
            dot={{ r: 3, fill: "#1e2530" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          >
            <LabelList dataKey="headcount" position="top" fontSize={10} fill="#374151" />
          </Line>
        </LineChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption="Evolución mensual del headcount"
        columns={["Mes", "Headcount", "Altas", "Bajas"]}
        rows={series.map((s) => [monthLabel(s.month), s.headcount ?? "sin dato", s.altas, s.bajas])}
      />
    </figure>
  );
}
