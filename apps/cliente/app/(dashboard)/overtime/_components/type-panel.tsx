"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtDec } from "../../_dashboard-kit/format";
import type { TypeItem } from "../_data/types";
import { fmtHours } from "./format";
import { CHART } from "../../_dashboard-kit/palette";

const MAX_BARS = 8;

/** Barras con "Otros" cuando hay más tipos que los que entran en el panel. */
function topWithOthers(items: TypeItem[]): TypeItem[] {
  if (items.length <= MAX_BARS) return items;
  const rest = items.slice(MAX_BARS - 1);
  return [
    ...items.slice(0, MAX_BARS - 1),
    { key: "others", label: "Otros", hours: rest.reduce((s, i) => s + i.hours, 0), share: rest.reduce((s, i) => s + i.share, 0) },
  ];
}

interface Props {
  byType: TypeItem[];
  unauthorized: { items: TypeItem[]; hours: number };
}

/**
 * Horas extra por tipo (50 %, 100 %, otra categoría, nocturna...). Las horas extra no autorizadas son un dato de
 * color: se muestran aparte, debajo, y no forman parte de ninguna tasa.
 */
export function TypePanel({ byType, unauthorized }: Props) {
  const router = useRouter();
  const data = topWithOthers(byType).map((i) => ({ ...i, value: i.hours }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {data.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Sin horas extra en el período.</p>
        ) : (
          <figure className="h-full w-full">
            <figcaption className="sr-only">
              {`Horas extra por tipo: ${byType.map((d) => `${d.label} ${fmtHours(d.hours)} (${fmtDec(d.share)} %)`).join(", ")}.`}
            </figcaption>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={136} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  content={({ active, payload }) => {
                    const p = active ? (payload?.[0]?.payload as TypeItem | undefined) : null;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-semibold">{p.label}</p>
                        <p>
                          {fmtHours(p.hours)} · {fmtDec(p.share)} % de las horas extra
                        </p>
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
                    formatter={(v: unknown) => (typeof v === "number" ? fmtHours(v) : "")}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ChartDataTable
              caption="Horas extra por tipo"
              columns={["Tipo de hora", "Horas", "% de las horas extra"]}
              rows={byType.map((i) => [
                i.href ? <Link key={i.key} href={i.href}>{i.label}</Link> : i.label,
                fmtDec(i.hours),
                fmtDec(i.share),
              ])}
            />
          </figure>
        )}
      </div>
      {unauthorized.hours > 0 && (
        <div className="mt-1 border-t pt-1.5 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">
            No autorizadas: {fmtHours(unauthorized.hours)} <span className="font-normal text-muted-foreground">(fuera de la tasa)</span>
          </p>
          <p>{unauthorized.items.map((i) => `${i.label} ${fmtHours(i.hours)}`).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
