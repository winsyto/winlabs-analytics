import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { STATE_LABEL, type JobState } from "../_data/job-result";

export type PillKind = JobState | "stale" | "never";

const STYLE: Record<PillKind, string> = {
  ok: "bg-wla-good/10 text-wla-good",
  errors: "bg-wla-bad/10 text-wla-bad",
  failed: "bg-wla-bad/10 text-wla-bad",
  running: "bg-muted text-foreground",
  stale: "bg-muted text-muted-foreground",
  never: "bg-muted text-muted-foreground",
};

/** Estado de una carga: ícono y texto (nunca solo color) */
export function StatusPill({ kind, label }: { kind: PillKind; label?: string }) {
  const text = label ?? (kind === "stale" ? "Desactualizada" : kind === "never" ? "Sin cargas" : STATE_LABEL[kind]);
  const Icon =
    kind === "ok" ? CheckCircle2 : kind === "errors" ? AlertTriangle : kind === "failed" ? XCircle : kind === "running" ? Loader2 : Info;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[kind]}`}>
      <Icon className={`h-3.5 w-3.5 ${kind === "running" ? "animate-spin" : ""}`} aria-hidden />
      {text}
    </span>
  );
}
