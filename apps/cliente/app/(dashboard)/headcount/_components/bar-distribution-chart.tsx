"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import type { DistItem } from "../_data/types";
import { CHART } from "../../_dashboard-kit/palette";

const MAX_BARS = 8;

function topWithOthers(items: DistItem[]): DistItem[] {
  if (items.length <= MAX_BARS) return items;
  const head = items.slice(0, MAX_BARS - 1);
  const rest = items.slice(MAX_BARS - 1).reduce((s, i) => s + i.value, 0);
  return [...head, { key: "others", label: "Otros", value: rest }];
}

export function BarDistributionChart({ items, name }: { items: DistItem[]; name: string }) {
  const router = useRouter();
  const total = items.reduce((s, i) => s + i.value, 0);
  const data = topWithOthers(items);

  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin datos para mostrar.</p>;
  }

  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {`Distribución por ${name}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}.`}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold">{p.label}</p>
                  <p>
                    {fmtInt(p.value)} personas · {total ? fmtDec((p.value / total) * 100) : "0,0"}%
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill={CHART.s1} radius={[0, 3, 3, 0]} barSize={14}
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
        caption={`Distribución por ${name}`}
        columns={[name, "Personas", "%"]}
        rows={items.map((i) => [i.href ? <Link key={i.key} href={i.href}>{i.label}</Link> : i.label, i.value, total ? `${fmtDec((i.value / total) * 100)}%` : "0,0%"])}
      />
    </figure>
  );
}
