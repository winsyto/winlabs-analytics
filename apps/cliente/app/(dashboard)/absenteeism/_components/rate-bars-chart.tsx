"use client";

import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import { RateBarsChart as KitRateBars, TabbedDimensions } from "../../_dashboard-kit/rate-bars-chart";
import { SMALL_SAMPLE, type AbsenceDisplay, type DimensionData, type UnitRateItem } from "../_data/types";
import { amountFull, fmtPct } from "./format";

const MAX_BARS = 8;

/** El grupo "Otros": su tasa combinada sale de sumar horas y horas programadas de las unidades que lo forman. */
function mergeOthers(rest: UnitRateItem[]): UnitRateItem {
  const sched = rest.reduce((s, i) => s + i.sched, 0);
  const hours = rest.reduce((s, i) => s + i.hours, 0);
  const people = rest.reduce((s, i) => s + i.people, 0);
  return {
    key: "others",
    label: `Otros (${rest.length})`,
    rate: sched > 0 ? (hours / sched) * 100 : null,
    hours,
    days: rest.reduce((s, i) => s + i.days, 0),
    sched,
    people,
    small: people < SMALL_SAMPLE,
  };
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
  return (
    <KitRateBars
      dimName={dim.name}
      items={dim.items}
      target={target}
      fmtRate={fmtPct}
      rateTitle="Tasa de ausentismo"
      noBase="sin horas programadas"
      smallSample={SMALL_SAMPLE}
      maxBars={MAX_BARS}
      merge={mergeOthers}
      tooltipDetail={(p) => (
        <>
          <p>Ausencia: {amountFull({ hours: p.hours, days: p.days }, display)}</p>
          <p>
            {fmtInt(p.people)} {p.people === 1 ? "persona" : "personas"}
            {p.small ? " · muestra chica" : ""}
          </p>
        </>
      )}
      tableColumns={["Horas", "Días", "Personas"]}
      tableCells={(i) => [fmtDec(i.hours), fmtDec(i.days), i.people]}
    />
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
  return (
    <TabbedDimensions
      dimensions={dimensions}
      subtitle={subtitle}
      renderChart={(dim) => <RateBarsChart dim={dim} target={target} display={display} />}
    />
  );
}
