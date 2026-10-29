"use client";

import type { ReactNode } from "react";
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
import { ChartDataTable } from "./chart-card";
import { fmtDec, monthLabel, monthShort } from "./format";
import { CHART } from "./palette";

export interface TrendPoint {
  /** Primer día del mes (YYYY-MM-DD) */
  month: string;
  /** Tasa en %; null = mes sin cobertura de datos */
  rate: number | null;
}

interface Props<T extends TrendPoint> {
  series: T[];
  target: number;
  /** Formato de una tasa con su unidad ("6,9 %") */
  fmtRate: (n: number) => string;
  /** Nombre de la tasa en el resumen para lectores de pantalla ("tasa de ausentismo") */
  rateName: string;
  /** Líneas extra del tooltip de un mes con datos (cantidades de la métrica) */
  tooltipDetail?: (point: T) => ReactNode;
  /** Forma de la línea: curva suave (por defecto) o recta, mejor cuando hay meses aislados en cero */
  curve?: "monotone" | "linear";
  /** Tabla equivalente del gráfico, para lectores de pantalla */
  table: { caption: string; columns: string[]; rows: (string | number | ReactNode)[][] };
}

/** Evolución mensual de una tasa con la meta como línea de referencia (la usan Ausentismos y Horas extras). */
export function RateTrendChart<T extends TrendPoint>({ series, target, fmtRate, rateName, tooltipDetail, curve = "monotone", table }: Props<T>) {
  const data = series.map((s) => ({ ...s, label: monthShort(s.month) }));
  const known = series.filter((s) => s.rate !== null);
  const first = known[0];
  const last = known[known.length - 1];
  const max = Math.max(target, ...known.map((s) => s.rate ?? 0));

  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {first && last
          ? `${rateName[0]!.toUpperCase()}${rateName.slice(1)} de ${monthLabel(first.month)} a ${monthLabel(last.month)}: de ${fmtRate(first.rate!)} a ${fmtRate(last.rate!)}. Meta: ${fmtRate(target)}.`
          : `Sin datos de ${rateName} en el rango.`}
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
            stroke={CHART.target}
            strokeDasharray="5 4"
            label={{ value: `Meta ${fmtRate(target)}`, position: "insideTopRight", fontSize: 10, fill: CHART.target }}
          />
          <Tooltip
            cursor={{ stroke: "#9ca3af", strokeDasharray: 3 }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as (T & { label: string }) | undefined) : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold">{monthLabel(p.month, "long")}</p>
                  <p>
                    Tasa: <strong>{p.rate === null ? "sin datos" : fmtRate(p.rate)}</strong>
                  </p>
                  {p.rate !== null && tooltipDetail?.(p)}
                </div>
              );
            }}
          />
          <Line
            type={curve}
            dataKey="rate"
            stroke={CHART.s1}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART.s1 }}
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
      <ChartDataTable caption={table.caption} columns={table.columns} rows={table.rows} />
    </figure>
  );
}
