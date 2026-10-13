import { cn } from "@wla/ui";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  footnote?: string;
  className?: string;
  children: React.ReactNode;
}

/** Contenedor de gráfico: el cuerpo ocupa el alto disponible (lg) o una altura fija (pantallas chicas). */
export function ChartCard({ title, subtitle, footnote, className, children }: ChartCardProps) {
  return (
    <section className={cn("flex min-h-0 flex-col rounded-lg border bg-card p-3", className)}>
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </header>
      <div className="relative h-60 min-h-0 lg:h-auto lg:flex-1">
        <div className="absolute inset-0">{children}</div>
      </div>
      {footnote && <p className="mt-1 text-[11px] text-muted-foreground">{footnote}</p>}
    </section>
  );
}

/** Equivalente tabular de un gráfico, solo para lectores de pantalla. */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
