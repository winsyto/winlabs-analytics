"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@wla/ui";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import type { ClassItem, Composition } from "../_data/types";
import { fmtMoney, fmtMoneyCompact, fmtShare } from "./format";
import { CHART } from "../../_dashboard-kit/palette";

const COLORS = { earning: CHART.s1, deduction: CHART.s2, unclassified: CHART.s3 } as const;

function ClassChart({ items, name, currency }: { items: ClassItem[]; name: string; currency: string }) {
  const router = useRouter();
  const data = items.map((i) => ({ ...i, value: Math.abs(i.amount) }));
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin {name.toLowerCase()} en el período.</p>;
  }
  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {`${name} por clase: ${items.map((d) => `${d.label} ${fmtMoney(Math.abs(d.amount), currency)} (${fmtShare(d.share)})`).join(", ")}.`}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 84, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={118} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as ClassItem | undefined) : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold">{p.label}</p>
                  <p>
                    {fmtMoney(Math.abs(p.amount), currency)} · {fmtShare(p.share)} de los haberes
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 3, 3, 0]}
            barSize={14}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(_: unknown, i: number) => {
              const h = data[i]?.href;
              if (h) router.push(h);
            }}
            fill={COLORS.earning}
            shape={(props: unknown) => {
              const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: ClassItem };
              return <rect x={x} y={y} width={Math.max(width, 0)} height={height} rx={3} fill={COLORS[payload.side]} />;
            }}
          >
            <LabelList
              dataKey="value"
              position="right"
              fontSize={11}
              fill="#374151"
              formatter={(v: unknown) => (typeof v === "number" ? fmtMoneyCompact(v, currency) : "")}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption={`${name} por clase`}
        columns={["Clase", "Importe", "% de los haberes"]}
        rows={items.map((i) => [
          i.href ? <Link key={i.key} href={i.href}>{i.label}</Link> : i.label,
          fmtMoney(Math.abs(i.amount), currency),
          fmtShare(i.share),
        ])}
      />
    </figure>
  );
}

const TABS = ["Haberes", "Retenciones"] as const;

/** Composición del período por clase de concepto: haberes (suman a la masa bruta) y retenciones (aparte, en valor absoluto). */
export function CompositionPanel({ composition, currency, subtitle }: { composition: Composition; currency: string; subtitle: string }) {
  const [tab, setTab] = useState(0);
  const earnings = [...composition.earnings, ...(composition.unclassified ? [composition.unclassified] : [])];
  return (
    <section className="flex min-h-0 flex-col rounded-lg border bg-card p-3">
      <header className="mb-1 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Composición por clase" className="flex gap-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`comp-tab-${i}`}
              aria-selected={i === tab}
              aria-controls="comp-tabpanel"
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
      <div id="comp-tabpanel" role="tabpanel" aria-labelledby={`comp-tab-${tab}`} className="relative h-60 min-h-0 lg:h-auto lg:flex-1">
        <div className="absolute inset-0">
          <ClassChart items={tab === 0 ? earnings : composition.deductions} name={TABS[tab]} currency={currency} />
        </div>
      </div>
    </section>
  );
}
