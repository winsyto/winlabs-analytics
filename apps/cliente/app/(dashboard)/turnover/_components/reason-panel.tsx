"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@wla/ui";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import type { ReasonItem } from "../_data/types";

const MAX_BARS = 8;

/** Barras con "Otros" cuando hay más motivos que los que entran en el panel. */
function topWithOthers(items: ReasonItem[]): ReasonItem[] {
  if (items.length <= MAX_BARS) return items;
  const rest = items.slice(MAX_BARS - 1);
  return [
    ...items.slice(0, MAX_BARS - 1),
    { key: "others", label: "Otros", count: rest.reduce((s, i) => s + i.count, 0), share: rest.reduce((s, i) => s + i.share, 0) },
  ];
}

function ReasonChart({ items, name }: { items: ReasonItem[]; name: string }) {
  const router = useRouter();
  const data = topWithOthers(items).map((i) => ({ ...i, value: i.count }));
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin bajas en el período.</p>;
  }
  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {`Bajas por ${name}: ${items.map((d) => `${d.label} ${d.count} (${fmtDec(d.share)} %)`).join(", ")}.`}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={136} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as ReasonItem | undefined) : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold">{p.label}</p>
                  <p>
                    {fmtInt(p.count)} {p.count === 1 ? "baja" : "bajas"} · {fmtDec(p.share)} %
                  </p>
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
            <LabelList dataKey="value" position="right" fontSize={11} fill="#374151" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption={`Bajas por ${name}`}
        columns={[name[0]!.toUpperCase() + name.slice(1), "Bajas", "% de las bajas"]}
        rows={items.map((i) => [i.href ? <Link key={i.key} href={i.href}>{i.label}</Link> : i.label, i.count, fmtDec(i.share)])}
      />
    </figure>
  );
}

const TABS = [
  { label: "Categoría", name: "categoría" },
  { label: "Motivo", name: "motivo" },
] as const;

/** Bajas del período por categoría y por motivo de baja. */
export function ReasonPanel({ byCategory, byReason, subtitle }: { byCategory: ReasonItem[]; byReason: ReasonItem[]; subtitle: string }) {
  const [tab, setTab] = useState(0);
  return (
    <section className="flex min-h-0 flex-col rounded-lg border bg-card p-3">
      <header className="mb-1 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Bajas por" className="flex gap-1">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              id={`reason-tab-${i}`}
              aria-selected={i === tab}
              aria-controls="reason-tabpanel"
              onClick={() => setTab(i)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                i === tab ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </header>
      <div id="reason-tabpanel" role="tabpanel" aria-labelledby={`reason-tab-${tab}`} className="relative h-60 min-h-0 lg:h-auto lg:flex-1">
        <div className="absolute inset-0">
          <ReasonChart items={tab === 0 ? byCategory : byReason} name={TABS[tab]!.name} />
        </div>
      </div>
    </section>
  );
}
