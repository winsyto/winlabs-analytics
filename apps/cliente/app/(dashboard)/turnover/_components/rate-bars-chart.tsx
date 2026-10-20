"use client";

import { fmtDec } from "../../_dashboard-kit/format";
import { RateBarsChart as KitRateBars, TabbedDimensions } from "../../_dashboard-kit/rate-bars-chart";
import { SMALL_SAMPLE, type DimensionData, type UnitRateItem } from "../_data/types";
import { fmtPct } from "./format";

const MAX_BARS = 8;

/** El grupo "Otros": su tasa combinada sale de sumar bajas y headcount promedio de las unidades que lo forman. */
function mergeOthers(rest: UnitRateItem[]): UnitRateItem {
  const avg = rest.reduce((s, i) => s + i.avgHeadcount, 0);
  const bajas = rest.reduce((s, i) => s + i.bajas, 0);
  return {
    key: "others",
    label: `Otros (${rest.length})`,
    rate: avg > 0 ? (bajas / avg) * 100 : null,
    bajas,
    avgHeadcount: avg,
    small: avg < SMALL_SAMPLE,
  };
}

export function RateBarsChart({ dim, target }: { dim: DimensionData; target: number }) {
  return (
    <KitRateBars
      dimName={dim.name}
      items={dim.items}
      target={target}
      fmtRate={fmtPct}
      rateTitle="Rotación"
      noBase="sin headcount"
      smallSample={SMALL_SAMPLE}
      maxBars={MAX_BARS}
      merge={mergeOthers}
      tooltipDetail={(p) => (
        <>
          <p>
            {p.bajas} {p.bajas === 1 ? "baja" : "bajas"}
          </p>
          <p>
            Headcount promedio: {fmtDec(p.avgHeadcount)}
            {p.small ? " · muestra chica" : ""}
          </p>
        </>
      )}
      tableColumns={["Bajas", "Headcount promedio"]}
      tableCells={(i) => [i.bajas, fmtDec(i.avgHeadcount)]}
    />
  );
}

/** Panel único con pestañas para las dimensiones que no entran como panel propio. */
export function TabbedRateDimensions({ dimensions, target, subtitle }: { dimensions: DimensionData[]; target: number; subtitle: string }) {
  return (
    <TabbedDimensions dimensions={dimensions} subtitle={subtitle} renderChart={(dim) => <RateBarsChart dim={dim} target={target} />} />
  );
}
