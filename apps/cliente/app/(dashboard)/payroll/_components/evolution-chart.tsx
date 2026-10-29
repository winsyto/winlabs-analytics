"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartDataTable } from "../../_dashboard-kit/chart-card";
import { fmtInt, monthLabel, monthShort } from "../../_dashboard-kit/format";
import { MIN_PERSONS, type SeriesPoint } from "../_data/types";
import { fmtMoney, fmtMoneyCompact } from "./format";
import { CHART } from "../../_dashboard-kit/palette";

const STATE_TEXT = {
  nodata: "sin datos",
  hidden: `reservado (menos de ${MIN_PERSONS} personas)`,
} as const;

/** Masa salarial bruta y neto pagado de los últimos 12 meses. Un mes sin liquidación figura como "sin datos". */
export function EvolutionChart({ series, currency, hasNet }: { series: SeriesPoint[]; currency: string; hasNet: boolean }) {
  const data = series.map((s) => ({ ...s, label: monthShort(s.month) }));
  const known = series.filter((s) => s.state === "ok");

  return (
    <figure className="h-full w-full">
      <figcaption className="sr-only">
        {known.length > 0
          ? `Masa salarial bruta mensual de ${monthLabel(known[0]!.month)} a ${monthLabel(known[known.length - 1]!.month)}: ${known.map((s) => `${monthLabel(s.month)} ${fmtMoney(s.gross ?? 0, currency)}`).join("; ")}.`
          : "Sin datos de masa salarial en el rango."}
      </figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 16, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#e2e5e0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v: number) => fmtMoneyCompact(v, currency)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={62} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as (SeriesPoint & { label: string }) | undefined) : null;
              if (!p) return null;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold">{monthLabel(p.month, "long")}</p>
                  {p.state !== "ok" ? (
                    <p>{STATE_TEXT[p.state]}</p>
                  ) : (
                    <>
                      <p>
                        Bruto: <strong>{fmtMoney(p.gross ?? 0, currency)}</strong>
                      </p>
                      {hasNet && p.net !== null && (
                        <p>
                          Neto: <strong>{fmtMoney(p.net, currency)}</strong>
                        </p>
                      )}
                      <p>Personas pagadas: {fmtInt(p.persons)}</p>
                    </>
                  )}
                </div>
              );
            }}
          />
          <Legend verticalAlign="top" align="right" height={20} iconType="square" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="gross" name="Bruto" fill={CHART.s1} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          {hasNet && <Bar dataKey="net" name="Neto" fill={CHART.s4} radius={[2, 2, 0, 0]} isAnimationActive={false} />}
        </BarChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption="Masa salarial por mes"
        columns={["Mes", "Bruto", ...(hasNet ? ["Neto"] : []), "Personas pagadas"]}
        rows={series.map((s) => [
          monthLabel(s.month),
          s.state === "ok" ? fmtMoney(s.gross ?? 0, currency) : STATE_TEXT[s.state],
          ...(hasNet ? [s.state === "ok" && s.net !== null ? fmtMoney(s.net, currency) : "—"] : []),
          s.state === "ok" ? s.persons : "—",
        ])}
      />
    </figure>
  );
}
