import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { monthLabel } from "../../_dashboard-kit/format";
import type { Freshness } from "../_data/types";

const WARN = "inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-900";

/** Frescura y calidad de los datos: último mes liquidado y configuración pendiente. */
export function PayrollFreshness({ refMonth, firstMonth, staleDays, isStale, partialFrom, unclassifiedConcepts, missingGross }: Freshness) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Última liquidación: {monthLabel(refMonth, "long")} · desde {monthLabel(firstMonth)}
      </span>
      {isStale && (
        <span className={WARN}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Sin liquidaciones nuevas hace {staleDays} días
        </span>
      )}
      {partialFrom && (
        <span className={WARN}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Cobertura parcial: el período se calcula desde {monthLabel(partialFrom)}
        </span>
      )}
      {(unclassifiedConcepts > 0 || missingGross) && (
        <Link href="/settings/payroll-concepts" className={`${WARN} hover:bg-amber-100`}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {unclassifiedConcepts > 0
            ? `${unclassifiedConcepts} ${unclassifiedConcepts === 1 ? "concepto sin clasificar" : "conceptos sin clasificar"}`
            : "Falta marcar el total bruto"}
          {" · configurar"}
        </Link>
      )}
    </div>
  );
}
