"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@wla/ui";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import { SMALL_SAMPLE, type AbsenceDisplay, type DimensionData, type UnitRateItem } from "../_data/types";
import { amountFull, fmtPct } from "./format";

const MAX_BARS = 8;

/** Las unidades con mayor tasa se muestran solas; el resto se agrupa en "Otros" con su tasa combinada. */
function topWithOthers(items: UnitRateItem[]): UnitRateItem[] {
  if (items.length <= MAX_BARS) return items;
  const head = items.slice(0, MAX_BARS - 1);
  const rest = items.slice(MAX_BARS - 1);
  const sched = rest.reduce((s, i) => s + i.sched, 0);
  const hours = rest.reduce((s, i) => s + i.hours, 0);
  const people = rest.reduce((s, i) => s + i.people, 0);
  return [
    ...head,
    {
      key: "others",
      label: `Otros (${rest.length})`,
      rate: sched > 0 ? (hours / sched) * 100 : null,
      hours,
      days: rest.reduce((s, i) => s + i.days, 0),
      sched,
      people,
      small: people < SMALL_SAMPLE,
    },
  ];
}

export function RateBarsChart({
  dim,
  target,
  display,
}: {
  dim: DimensionData;
  target: number;
  display: AbsenceDisplay;
}) {
  const router = useRouter();
  const data = topWithOthers(dim.items).map((i) => ({
    ...i,
    axisLabel: `${i.label}${i.small ? " *" : ""}`,
    value: i.rate ?? 0,
  }));
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin datos para mostrar.</p>;
  }
  const max = Math.max(target, ...data.map((d) => d.value));
  const anySmall = dim.items.some((i) => i.small);

  return (
    <figure className="flex h-full w-full flex-col">
      <figcaption className="sr-only">
        {`Tasa de ausentismo por ${dim.name}: ${dim.items.map((d) => `${d.label} ${d.rate === null ? "sin horas programadas" : fmtPct(d.rate)}${d.small ? " (muestra chica)" : ""}`).join(", ")}. Meta ${fmtPct(target)}.`}
      </figcaption>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, Math.ceil(max * 1.1 * 2) / 2]} />
            <YAxis type="category" dataKey="axisLabel" width={118} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
            <ReferenceLine x={target} stroke="#b45309" strokeDasharray="4 3" />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={({ active, payload }) => {
                const p = active ? payload?.[0]?.payload : null;
                if (!p) return null;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold">{p.label}</p>
                    <p>Tasa: <strong>{p.rate === null ? "sin horas programadas" : fmtPct(p.rate)}</strong></p>
                    <p>Ausencia: {amountFull({ hours: p.hours, days: p.days }, display)}</p>
                    <p>{fmtInt(p.people)} {p.people === 1 ? "persona" : "personas"}{p.small ? " · muestra chica" : ""}</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              fill="#1e2530"
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
      {anySmall && (
        <p className="text-[10px] text-muted-foreground">* Muestra chica: menos de {SMALL_SAMPLE} personas.</p>
      )}
      <ChartDataTable
        caption={`Tasa de ausentismo por ${dim.name}`}
        columns={[dim.name, "Tasa", "Horas", "Días", "Personas"]}
        rows={dim.items.map((i) => [
          i.href ? <Link key={i.key} href={i.href}>{i.label}{i.small ? " (muestra chica)" : ""}</Link> : `${i.label}${i.small ? " (muestra chica)" : ""}`,
          i.rate === null ? "sin horas programadas" : fmtPct(i.rate),
          fmtDec(i.hours),
          fmtDec(i.days),
          i.people,
        ])}
      />
    </figure>
  );
}

/** Panel único con pestañas para las dimensiones que no entran como panel propio. */
export function TabbedRateDimensions({
  dimensions,
  target,
  display,
  subtitle,
}: {
  dimensions: DimensionData[];
  target: number;
  display: AbsenceDisplay;
  subtitle: string;
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
        <div className="absolute inset-0">
          <RateBarsChart dim={dim} target={target} display={display} />
        </div>
      </div>
    </section>
  );
}
