"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@wla/ui";
import { ChartDataTable } from "./chart-card";
import { fmtDec } from "./format";
import { CHART } from "./palette";

export interface RateBarItem {
  key: string;
  label: string;
  /** Tasa en %; null si la unidad no tuvo base de cálculo */
  rate: number | null;
  /** Muestra chica: pocas personas */
  small: boolean;
  href?: string;
}

/**
 * Las unidades con mayor tasa se muestran solas; el resto se agrupa en "Otros" con su tasa combinada.
 * `merge` arma el ítem combinado (cada dashboard sabe cómo sumar sus numeradores y denominadores).
 */
export function capBars<T extends RateBarItem>(items: T[], max: number, merge: (rest: T[]) => T): T[] {
  if (items.length <= max) return items;
  return [...items.slice(0, max - 1), merge(items.slice(max - 1))];
}

interface BarsProps<T extends RateBarItem> {
  /** Nombre de la dimensión ("Área") */
  dimName: string;
  items: T[];
  target: number;
  fmtRate: (n: number) => string;
  /** Nombre de la tasa para el resumen para lectores de pantalla ("Tasa de ausentismo") */
  rateTitle: string;
  /** Texto cuando la unidad no tiene base ("sin horas programadas") */
  noBase: string;
  /** Líneas extra del tooltip: cantidades de la métrica y personas (indicar "muestra chica" si corresponde) */
  tooltipDetail: (item: T) => ReactNode;
  /** Columnas extra de la tabla equivalente, además de la dimensión y la tasa */
  tableColumns: string[];
  tableCells: (item: T) => (string | number)[];
  /** Personas por debajo de las cuales una unidad es muestra chica */
  smallSample: number;
  maxBars?: number;
  /** Cómo combinar las unidades que no entran como barra propia */
  merge: (rest: T[]) => T;
}

/** Barras horizontales de una tasa por unidad de una dimensión, con la meta como línea de referencia. */
export function RateBarsChart<T extends RateBarItem>({
  dimName,
  items,
  target,
  fmtRate,
  rateTitle,
  noBase,
  tooltipDetail,
  tableColumns,
  tableCells,
  smallSample,
  maxBars = 8,
  merge,
}: BarsProps<T>) {
  const router = useRouter();
  const data = capBars(items, maxBars, merge).map((i) => ({
    ...i,
    axisLabel: `${i.label}${i.small ? " *" : ""}`,
    value: i.rate ?? 0,
  }));
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin datos para mostrar.</p>;
  }
  const max = Math.max(target, ...data.map((d) => d.value));
  const anySmall = items.some((i) => i.small);

  return (
    <figure className="flex h-full w-full flex-col">
      <figcaption className="sr-only">
        {`${rateTitle} por ${dimName}: ${items.map((d) => `${d.label} ${d.rate === null ? noBase : fmtRate(d.rate)}${d.small ? " (muestra chica)" : ""}`).join(", ")}. Meta ${fmtRate(target)}.`}
      </figcaption>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, Math.ceil(max * 1.1 * 2) / 2]} />
            <YAxis type="category" dataKey="axisLabel" width={118} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
            <ReferenceLine x={target} stroke={CHART.target} strokeDasharray="4 3" />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as (T & { axisLabel: string }) | undefined) : null;
                if (!p) return null;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold">{p.label}</p>
                    <p>
                      Tasa: <strong>{p.rate === null ? noBase : fmtRate(p.rate)}</strong>
                    </p>
                    {tooltipDetail(p)}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              fill={CHART.s1}
              radius={[0, 3, 3, 0]}
              barSize={14}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(_: unknown, i: number) => {
                const h = data[i]?.href;
                if (h) router.push(h);
              }}
            >
              <LabelList
                dataKey="value"
                position="right"
                fontSize={11}
                fill="#374151"
                formatter={(v: unknown) => (typeof v === "number" ? fmtDec(v) : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {anySmall && <p className="text-[10px] text-muted-foreground">* Muestra chica: menos de {smallSample} personas.</p>}
      <ChartDataTable
        caption={`${rateTitle} por ${dimName}`}
        columns={[dimName, "Tasa", ...tableColumns]}
        rows={items.map((i) => [
          i.href ? (
            <Link key={i.key} href={i.href}>
              {i.label}
              {i.small ? " (muestra chica)" : ""}
            </Link>
          ) : (
            `${i.label}${i.small ? " (muestra chica)" : ""}`
          ),
          i.rate === null ? noBase : fmtRate(i.rate),
          ...tableCells(i),
        ])}
      />
    </figure>
  );
}

/** Panel único con pestañas para las dimensiones que no entran como panel propio. */
export function TabbedDimensions<D extends { code: string; name: string; slug: string }>({
  dimensions,
  subtitle,
  renderChart,
}: {
  dimensions: D[];
  subtitle: string;
  renderChart: (dim: D) => ReactNode;
}) {
  const [active, setActive] = useState(0);
  const dim = dimensions[active] ?? dimensions[0]!;
  return (
    <section className="flex min-h-0 flex-col rounded-lg border bg-card p-3">
      <header className="mb-1 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Otras dimensiones" className="flex flex-wrap gap-1">
          {dimensions.map((d, i) => (
            <button
              key={d.code}
              type="button"
              role="tab"
              id={`dim-tab-${d.slug}`}
              aria-selected={i === active}
              aria-controls="dim-tabpanel"
              onClick={() => setActive(i)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                i === active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </header>
      <div id="dim-tabpanel" role="tabpanel" aria-labelledby={`dim-tab-${dim.slug}`} className="relative h-60 min-h-0 lg:h-auto lg:flex-1">
        <div className="absolute inset-0">{renderChart(dim)}</div>
      </div>
    </section>
  );
}
