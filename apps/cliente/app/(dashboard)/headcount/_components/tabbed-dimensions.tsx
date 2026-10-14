"use client";

import { useState } from "react";
import { cn } from "@wla/ui";
import { monthLabel } from "../../_dashboard-kit/format";
import type { DimensionData } from "../_data/types";
import { DimensionChart } from "./dimension-chart";

/** Panel único con pestañas para las dimensiones que no entran como panel propio. */
export function TabbedDimensions({ dimensions, refMonth }: { dimensions: DimensionData[]; refMonth: string }) {
  const [active, setActive] = useState(0);
  const dim = dimensions[active] ?? dimensions[0]!;

  return (
    <section className="flex min-h-0 flex-col rounded-lg border bg-card p-3">
      <header className="mb-1 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Otras dimensiones" className="flex flex-wrap gap-1">
          {dimensions.map((d, i) => (
            <button
              key={d.code}
              type="button"
              role="tab"
              id={`dim-tab-${d.slug}`}
              aria-selected={i === active}
              aria-controls="dim-tabpanel"
              onClick={() => setActive(i)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                i === active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">Cierre de {monthLabel(refMonth)}</p>
      </header>
      <div
        id="dim-tabpanel"
        role="tabpanel"
        aria-labelledby={`dim-tab-${dim.slug}`}
        className="relative h-60 min-h-0 lg:h-auto lg:flex-1"
      >
        <div className="absolute inset-0">
          <DimensionChart dim={dim} />
        </div>
      </div>
    </section>
  );
}
