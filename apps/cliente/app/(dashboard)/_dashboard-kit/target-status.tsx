import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { fmtPct, fmtPp } from "./format";

/**
 * Estado de una tasa contra la meta del tenant: ícono y texto (nunca solo color).
 * Para tasas donde más es peor (ausentismo, horas extra, rotación). `note` aclara la meta cuando está prorrateada.
 */
export function TargetStatus({ value, target, note }: { value: number | null; target: number; note?: string }) {
  if (value === null) return <p className="mt-1 text-[11px] text-muted-foreground">Meta {fmtPct(target)}{note ? ` ${note}` : ""}</p>;
  const diff = value - target;
  const above = diff > 0.05;
  const Icon = above ? AlertTriangle : CheckCircle2;
  return (
    <p className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${above ? "text-wla-bad" : "text-wla-good"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      Meta {fmtPct(target)}{note ? ` ${note}` : ""}: {above ? `${fmtPp(diff)} sobre la meta` : `dentro de la meta (${fmtPp(diff)})`}
    </p>
  );
}
