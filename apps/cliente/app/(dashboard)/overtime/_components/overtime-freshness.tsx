import { AlertTriangle, Clock } from "lucide-react";
import { fmtDate, monthLabel } from "../../_dashboard-kit/format";
import type { Freshness } from "../_data/types";

/** Frescura y cobertura de los datos: mes de cierre, desde cuándo hay horas por tipo y última carga. */
export function OvertimeFreshness({ refMonth, firstMonth, lastLoad, staleDays, isStale, partialFrom }: Freshness) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Datos al cierre de {monthLabel(refMonth, "long")} · horas desde {monthLabel(firstMonth)}
        {lastLoad && ` · última carga ${fmtDate(lastLoad)}`}
      </span>
      {isStale && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Sin actualizar hace {staleDays} días
        </span>
      )}
      {partialFrom && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Cobertura parcial: el período se calcula desde {monthLabel(partialFrom)}
        </span>
      )}
    </div>
  );
}
