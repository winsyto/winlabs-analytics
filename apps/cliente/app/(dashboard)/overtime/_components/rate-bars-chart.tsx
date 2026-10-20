"use client";

import { fmtDec, fmtInt } from "../../_dashboard-kit/format";
import { RateBarsChart as KitRateBars, TabbedDimensions } from "../../_dashboard-kit/rate-bars-chart";
import { SMALL_SAMPLE, type DimensionData, type UnitRateItem } from "../_data/types";
import { fmtHours, fmtPct } from "./format";

const MAX_BARS = 8;

/** El grupo "Otros": su tasa combinada sale de sumar horas extra y base de las unidades que lo forman. */
function mergeOthers(rest: UnitRateItem[]): UnitRateItem {
  const base = rest.reduce((s, i) => s + i.base, 0);
  const hours = rest.reduce((s, i) => s + i.hours, 0);
  const people = rest.reduce((s, i) => s + i.people, 0);
  return {
    key: "others",
    label: `Otros (${rest.length})`,
    rate: base > 0 ? (hours / base) * 100 : null,
    hours,
    base,
    people,
    small: people < SMALL_SAMPLE,
  };
}

export function RateBarsChart({ dim, target }: { dim: DimensionData; target: number }) {
  return (
    <KitRateBars
      dimName={dim.name}
      items={dim.items}
      target={target}
      fmtRate={fmtPct}
      rateTitle="Tasa de horas extra"
      noBase="sin horas informadas"
      smallSample={SMALL_SAMPLE}
      maxBars={MAX_BARS}
      merge={mergeOthers}
      tooltipDetail={(p) => (
        <>
          <p>Horas extra: {fmtHours(p.hours)}</p>
          <p>
            {fmtInt(p.people)} {p.people === 1 ? "persona" : "personas"} con horas informadas
            {p.small ? " · muestra chica" : ""}
          </p>
        </>
      )}
      tableColumns={["Horas extra", "Base", "Personas"]}
      tableCells={(i) => [fmtDec(i.hours), fmtDec(i.base), i.people]}
    />
  );
}

/** Panel único con pestañas para las dimensiones que no entran como panel propio. */
export function TabbedRateDimensions({ dimensions, target, subtitle }: { dimensions: DimensionData[]; target: number; subtitle: string }) {
  return (
    <TabbedDimensions dimensions={dimensions} subtitle={subtitle} renderChart={(dim) => <RateBarsChart dim={dim} target={target} />} />
  );
}
