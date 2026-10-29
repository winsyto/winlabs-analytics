"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtInt } from "../../_dashboard-kit/format";
import { TabbedDimensions } from "../../_dashboard-kit/rate-bars-chart";
import { MIN_PERSONS, type DimensionData, type UnitCostItem } from "../_data/types";
import { fmtMoney, fmtMoneyCompact } from "./format";
import { CHART } from "../../_dashboard-kit/palette";

const MAX_BARS = 8;

/** Costo medio mensual por persona de cada unidad de una dimensión. Las unidades con menos de 3 personas no muestran importe. */
export function CostBarsChart({
  dim,
  currency,
  valueLabel = "Costo medio",
  totalLabel = "Masa bruta",
}: {
  dim: DimensionData;
  currency: string;
  valueLabel?: string;
  totalLabel?: string;
}) {
  const router = useRouter();
  const items = dim.items;
  const shown = items.length > MAX_BARS ? items.slice(0, MAX_BARS) : items;
  const rest = items.length > MAX_BARS ? items.length - MAX_BARS : 0;
  const data = shown.map((i) => ({ ...i, axisLabel: i.hidden ? `${i.label} *` : i.label, value: i.cost ?? 0 }));
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Sin datos para mostrar.</p>;
  }
  const anyHidden = items.some((i) => i.hidden);

  return (
    <figure className="flex h-full w-full flex-col">
      <figcaption className="sr-only">
        {`${valueLabel} por ${dim.name}: ${items.map((d) => `${d.label} ${d.cost === null ? "reservado" : fmtMoney(d.cost, currency)}`).join(", ")}.`}
      </figcaption>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="axisLabel" width={118} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as (UnitCostItem & { axisLabel: string }) | undefined) : null;
                if (!p) return null;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold">{p.label}</p>
                    {p.hidden ? (
                      <p>Reservado: menos de {MIN_PERSONS} personas</p>
                    ) : (
                      <>
                        <p>
                          {valueLabel}: <strong>{fmtMoney(p.cost ?? 0, currency)}</strong>
                        </p>
                        <p>{totalLabel}: {fmtMoney(p.total ?? 0, currency)}</p>
                        <p>Personas: {fmtInt(p.persons)}</p>
                      </>
                    )}
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
                formatter={(v: unknown) => (typeof v === "number" && v > 0 ? fmtMoneyCompact(v, currency) : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {rest > 0 && <p className="text-[10px] text-muted-foreground">Se muestran las {MAX_BARS} unidades de mayor costo; hay {rest} más en el detalle.</p>}
      {anyHidden && <p className="text-[10px] text-muted-foreground">* Menos de {MIN_PERSONS} personas: el importe se reserva por privacidad.</p>}
      <ChartDataTable
        caption={`${valueLabel} por ${dim.name}`}
        columns={[dim.name, valueLabel, "Personas"]}
        rows={items.map((i) => [
          i.href ? <Link key={i.key} href={i.href}>{i.label}</Link> : i.label,
          i.cost === null ? "reservado" : fmtMoney(i.cost, currency),
          i.persons,
        ])}
      />
    </figure>
  );
}

/** Panel único con pestañas para las dimensiones que no entran como panel propio. */
export function TabbedCostDimensions({
  dimensions,
  currency,
  subtitle,
  valueLabel,
  totalLabel,
}: {
  dimensions: DimensionData[];
  currency: string;
  subtitle: string;
  valueLabel?: string;
  totalLabel?: string;
}) {
  return (
    <TabbedDimensions
      dimensions={dimensions}
      subtitle={subtitle}
      renderChart={(dim) => <CostBarsChart dim={dim} currency={currency} valueLabel={valueLabel} totalLabel={totalLabel} />}
    />
  );
}
