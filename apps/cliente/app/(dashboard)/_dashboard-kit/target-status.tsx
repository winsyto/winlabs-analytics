import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { fmtPct, fmtPp } from "./format";

/**
 * Estado de una tasa contra la meta del tenant: ícono y texto (nunca solo color).
 * Para tasas donde más es peor (ausentismo, horas extra, rotación).
 */
export function TargetStatus({ value, target }: { value: number | null; target: number }) {
  if (value === null) return <p className="mt-1 text-[11px] text-muted-foreground">Meta {fmtPct(target)}</p>;
  const diff = value - target;
  const above = diff > 0.05;
  const Icon = above ? AlertTriangle : CheckCircle2;
  return (
    <p className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${above ? "text-amber-800" : "text-foreground"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      Meta {fmtPct(target)}: {above ? `${fmtPp(diff)} sobre la meta` : `dentro de la meta (${fmtPp(diff)})`}
    </p>
  );
}
