"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import type { DistItem } from "../_data/types";

const PALETTE = ["#1e2530", "#dc2626", "#2563eb", "#d97706", "#9ca3af"];

export function DimensionDonut({ items, name }: { items: DistItem[]; name: string }) {
  const router = useRouter();
  const total = items.reduce((s, i) => s + i.value, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin datos para mostrar.</p>;
  }

  return (
    <figure className="flex h-full w-full items-center gap-3">
      <figcaption className="sr-only">
        {`Distribución por ${name}: ${items.map((i) => `${i.label} ${i.value}`).join(", ")}.`}
      </figcaption>
      <div className="h-full min-h-0 w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                const p = active ? payload?.[0]?.payload : null;
                if (!p) return null;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold">{p.label}</p>
                    <p>{fmtInt(p.value)} personas</p>
                  </div>
                );
              }}
            />
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={items.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
              cursor="pointer"
              onClick={(_: unknown, i: number) => {
                const h = items[i]?.href;
                if (h) router.push(h);
              }}
            >
              {items.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              aria-hidden
            />
            {it.href ? (
              <Link href={it.href} className="truncate hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                {it.label}
              </Link>
            ) : (
              <span className="truncate">{it.label}</span>
            )}
            <span className="ml-auto whitespace-nowrap tabular-nums text-muted-foreground">
              {fmtInt(it.value)} · {fmtDec((it.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <ChartDataTable
        caption={`Distribución por ${name}`}
        columns={[name, "Personas", "%"]}
        rows={items.map((i) => [i.label, i.value, `${fmtDec((i.value / total) * 100)}%`])}
      />
    </figure>
  );
}
