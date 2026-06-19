import * as React from "react";
import { cn } from "../lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  className?: string;
}

const deltaColors: Record<NonNullable<KpiCardProps["deltaDirection"]>, string> = {
  up: "text-emerald-600",
  down: "text-red-600",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  delta,
  deltaDirection = "neutral",
  className,
}: KpiCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-1", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {delta && (
        <p className={cn("text-xs font-medium", deltaColors[deltaDirection])}>
          {delta}
        </p>
      )}
    </div>
  );
}
