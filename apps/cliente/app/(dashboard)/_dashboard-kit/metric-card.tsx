import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Minus } from "lucide-react";
import { fmtDec, fmtInt, fmtSigned, fmtSignedPct } from "./format";

interface MetricCardProps {
  label: string;
  value: number | null;
  prev: number | null;
  avg: number | null;
  avgLabel: string;
  compareLabel: string;
  /** Muestra el valor con signo (p. ej. variación neta) */
  signed?: boolean;
  /** Oculta el % de variación (no tiene sentido sobre valores con signo cercanos a cero) */
  hidePct?: boolean;
  /** Si se define, la tarjeta navega al detalle de personas */
  href?: string;
  /** Formato del valor (por defecto, entero). Útil para porcentajes o cantidades con unidad */
  formatValue?: (n: number) => string;
  /** Formato de la variación absoluta (por defecto, entero con signo) */
  formatDiff?: (n: number) => string;
  /** Formato de la referencia secundaria (por defecto, un decimal) */
  formatAvg?: (n: number) => string;
  /** Contenido adicional bajo la variación (referencias, metas, avisos) */
  children?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  prev,
  avg,
  avgLabel,
  compareLabel,
  signed,
  hidePct,
  href,
  formatValue,
  formatDiff,
  formatAvg,
  children,
}: MetricCardProps) {
  const diff = value !== null && prev !== null ? value - prev : null;
  const pct =
    !hidePct && diff !== null && prev !== null && prev !== 0 ? (diff / Math.abs(prev)) * 100 : null;
  const Icon = diff === null || diff === 0 ? Minus : diff > 0 ? ArrowUp : ArrowDown;

  return (
    <div className="relative rounded-lg border bg-card px-4 py-3 transition-colors has-[a:hover]:border-foreground/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-ring">
      <p className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 hover:underline focus:outline-none">
            {label}
            <span className="sr-only"> — ver detalle de personas</span>
          </Link>
        ) : (
          label
        )}
        {href && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
      </p>
      <p className="mt-0.5 text-3xl font-bold tabular-nums text-foreground">
        {value === null ? "—" : formatValue ? formatValue(value) : signed ? fmtSigned(value) : fmtInt(value)}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {diff === null ? (
          <span className="text-muted-foreground">Sin comparación disponible</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Variación </span>
            {formatDiff ? formatDiff(diff) : fmtSigned(diff)}
            {pct !== null && ` (${fmtSignedPct(pct)})`}
            <span className="font-normal text-muted-foreground">{compareLabel}</span>
          </span>
        )}
        {avg !== null && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {avgLabel}: {formatAvg ? formatAvg(avg) : fmtDec(avg)}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
