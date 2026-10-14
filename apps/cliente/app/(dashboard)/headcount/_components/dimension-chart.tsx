import type { DimensionData } from "../_data/types";
import { BarDistributionChart } from "./bar-distribution-chart";
import { DimensionDonut } from "./dimension-donut";

/** Dona si la dimensión tiene hasta 4 unidades (parte-todo legible); barras si tiene más. "Sin asignar" no cuenta. */
export const DONUT_MAX_UNITS = 4;

export function DimensionChart({ dim }: { dim: DimensionData }) {
  const units = dim.items.filter((i) => i.key !== "none").length;
  return units <= DONUT_MAX_UNITS ? (
    <DimensionDonut items={dim.items} name={dim.name} />
  ) : (
    <BarDistributionChart items={dim.items} name={dim.name} />
  );
}
