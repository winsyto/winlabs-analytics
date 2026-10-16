"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@wla/ui";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import type { AbsenceDisplay, BreakdownItem } from "../_data/types";
import { amountFull, fmtDays, fmtHours } from "./format";

const MAX_BARS = 8;

/** Barras con "Otros" cuando hay más categorías que las que entran en el panel. */
function topWithOthers(items: BreakdownItem[]): BreakdownItem[] {
  if (items.length <= MAX_BARS) return items;
  const head = items.slice(0, MAX_BARS - 1);
  const rest = items.slice(MAX_BARS - 1);
  return [
    ...head,
    {
      key: "others",
      label: "Otros",
      hours: rest.reduce((s, i) => s + i.hours, 0),
      days: rest.reduce((s, i) => s + i.days, 0),
      events: rest.reduce((s, i) => s + i.events, 0),
      share: rest.reduce((s, i) => s + i.share, 0),
    },
  ];
}

function BreakdownChart({ items, name, display }: { items: BreakdownItem[]; name: string; display: AbsenceDisplay }) {
  const router = useRouter();
  const data = topWithOthers(items).map((i) => ({ ...i, value: display === "hours" ? i.hours : i.days }));
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin ausencias en el período.</p>;
  }
  const unit = (v: number) => (display === "hours" ? fmtHours(v) : fmtDays(v));
  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {`Ausencia por ${name}: ${items.map((d) => `${d.label} ${amountFull({ hours: d.hours, days: d.days }, display)} (${fmtDec(d.share)}%)`).join(", ")}.`}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={136} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold">{p.label}</p>
                  <p>{amountFull({ hours: p.hours, days: p.days }, display)} · {fmtDec(p.share)} %</p>
                  <p>{fmtInt(p.events)} {p.events === 1 ? "evento" : "eventos"}</p>
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
            <LabelList dataKey="value" position="right" fontSize={11} fill="#374151" formatter={(v: unknown) => (typeof v === "number" ? unit(v) : "")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption={`Ausencia por ${name}`}
        columns={[name, "Días", "Horas", "Eventos", "%"]}
        rows={items.map((i) => [i.href ? <Link key={i.key} href={i.href}>{i.label}</Link> : i.label, fmtDays(i.days), fmtHours(i.hours), i.events, `${fmtDec(i.share)} %`])}
      />
    </figure>
  );
}

/** Panel con dos pestañas: la ausencia del período por clase y por tipo. */
export function BreakdownPanel({
  byClass,
  byType,
  display,
  subtitle,
}: {
  byClass: BreakdownItem[];
  byType: BreakdownItem[];
  display: AbsenceDisplay;
  subtitle: string;
}) {
  const [tab, setTab] = useState<"class" | "type">("class");
  const tabs = [
    { key: "class" as const, label: "Por clase" },
    { key: "type" as const, label: "Por tipo" },
  ];
  return (
    <section className="flex min-h-0 flex-col rounded-lg border bg-card p-3">
      <header className="mb-1 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Ausencia por clase o tipo" className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`breakdown-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="breakdown-tabpanel"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                tab === t.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </header>
      <div
        id="breakdown-tabpanel"
        role="tabpanel"
        aria-labelledby={`breakdown-tab-${tab}`}
        className="relative h-60 min-h-0 lg:h-auto lg:flex-1"
      >
        <div className="absolute inset-0">
          <BreakdownChart
            items={tab === "class" ? byClass : byType}
            name={tab === "class" ? "clase" : "tipo"}
            display={display}
          />
        </div>
      </div>
    </section>
  );
}
