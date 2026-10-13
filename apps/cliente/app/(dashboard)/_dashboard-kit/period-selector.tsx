"use client";

import { cn } from "@wla/ui";
import { useDashboardParams } from "./dashboard-shell";

interface PeriodOption {
  value: string;
  label: string;
}

export function PeriodSelector({
  options,
  value,
  defaultValue,
}: {
  options: PeriodOption[];
  value: string;
  defaultValue: string;
}) {
  const { setParams } = useDashboardParams();
  return (
    <div role="radiogroup" aria-label="Período" className="inline-flex rounded-md border bg-card p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setParams({ p: o.value === defaultValue ? null : o.value })}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
