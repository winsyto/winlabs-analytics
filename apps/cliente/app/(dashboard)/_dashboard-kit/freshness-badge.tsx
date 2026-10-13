import { AlertTriangle, Clock } from "lucide-react";
import { monthLabel } from "./format";

interface FreshnessBadgeProps {
  refMonth: string;
  firstMonth: string;
  staleDays: number;
  isStale: boolean;
  hasGaps: boolean;
}

export function FreshnessBadge({ refMonth, firstMonth, staleDays, isStale, hasGaps }: FreshnessBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Datos al cierre de {monthLabel(refMonth, "long")} · historial desde {monthLabel(firstMonth)}
      </span>
      {isStale && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Sin actualizar hace {staleDays} días
        </span>
      )}
      {hasGaps && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Historial con meses faltantes
        </span>
      )}
    </div>
  );
}
