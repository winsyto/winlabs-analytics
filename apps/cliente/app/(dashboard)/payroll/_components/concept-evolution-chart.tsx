"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtInt, monthLabel, monthShort } from "../../_dashboard-kit/format";
import { MIN_PERSONS } from "../_data/types";
import type { ConceptSeriesPoint } from "../_data/concept-queries";
import { fmtMoney, fmtMoneyCompact } from "./format";
import { CHART } from "../../_dashboard-kit/palette";

const STATE_TEXT = { nodata: "sin datos", hidden: `reservado (menos de ${MIN_PERSONS} personas)` } as const;

/** Importe de un concepto mes a mes (últimos 12 meses). Un mes sin liquidación figura como "sin datos". */
export function ConceptEvolutionChart({ series, currency, name }: { series: ConceptSeriesPoint[]; currency: string; name: string }) {
  const data = series.map((s) => ({ ...s, label: monthShort(s.month), value: s.amount ?? 0 }));
  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {`${name} por mes: ${series.map((s) => `${monthLabel(s.month)} ${s.state === "ok" ? fmtMoney(s.amount ?? 0, currency) : STATE_TEXT[s.state]}`).join("; ")}.`}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e5e0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, currency)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={62} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as (ConceptSeriesPoint & { label: string }) | undefined) : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold">{monthLabel(p.month, "long")}</p>
                  {p.state !== "ok" ? (
                    <p>{STATE_TEXT[p.state]}</p>
                  ) : (
                    <>
                      <p>
                        Importe: <strong>{fmtMoney(p.amount ?? 0, currency)}</strong>
                      </p>
                      <p>Personas: {fmtInt(p.persons)}</p>
                    </>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="value" name={name} fill={CHART.s1} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption={`${name} por mes`}
        columns={["Mes", "Importe", "Personas"]}
        rows={series.map((s) => [monthLabel(s.month), s.state === "ok" ? fmtMoney(s.amount ?? 0, currency) : STATE_TEXT[s.state], s.state === "ok" ? s.persons : "—"])}
      />
    </figure>
  );
}
