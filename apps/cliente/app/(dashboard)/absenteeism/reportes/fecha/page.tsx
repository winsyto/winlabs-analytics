import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { auth } from "@/auth";
import { Breadcrumb } from "../../../_dashboard-kit/breadcrumb";
import { DashboardShell } from "../../../_dashboard-kit/dashboard-shell";
import { DashboardEmpty } from "../../../_dashboard-kit/dashboard-states";
import { filterTokens, NONE_TOKEN } from "../../../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../../../_dashboard-kit/dimensions";
import { ExportMenu } from "../../../_dashboard-kit/export-menu";
import { fmtDate } from "../../../_dashboard-kit/format";
import { fmtPct } from "../../_components/format";
import { DateReportFilters } from "../_components/date-report-filters";
import { dateReportQuery, loadDateReport, parseDateReportParams, type DateReportRow } from "../_data/by-date";

export const metadata = { title: "Ausentismos · Resumen por fecha y unidad" };

const num = (n: number) =>
  Number.isInteger(Math.round(n * 10) / 10) && Math.round(n * 10) % 10 === 0
    ? new Intl.NumberFormat("es-AR").format(Math.round(n))
    : new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

type Col = { label: string; get: (r: DateReportRow) => string; strong?: boolean };

export default async function DateReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDashboardDimensions(tenantId, "absenteeism");
  const params = parseDateReportParams(await searchParams, dimensions);
  const data = await loadDateReport(tenantId, dimensions, params);

  const crumbs = [{ label: "Ausentismos", href: "/absenteeism" }, { label: "Resumen por fecha y unidad" }];

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <Breadcrumb items={crumbs} />
        <DashboardEmpty title="Todavía no hay datos de ausentismo" text="Cargá el archivo de Ausentismo para ver el resumen por fecha y unidad." />
      </DashboardShell>
    );
  }

  const { rows, total, singleDay, groupName } = data;
  const q = dateReportQuery(params, dimensions);
  const exportHref = (format: "xlsx" | "pdf") => {
    const e = new URLSearchParams(q);
    e.set("format", format);
    return `/absenteeism/reportes/fecha/export?${e.toString()}`;
  };
  const dayLabel = singleDay ? fmtDate(params.from) : `${fmtDate(params.from)} al ${fmtDate(params.to)}`;
  const unit = singleDay ? "personas" : "personas-día";
  const today = new Date().toISOString().slice(0, 10);

  const presence: Col[] = [
    { label: "Presentes (estimado)", get: (r) => num(r.present), strong: true },
    { label: "Franco", get: (r) => num(r.dayOff) },
    { label: "Vacaciones", get: (r) => num(r.vacation) },
    { label: "Lic. de ley", get: (r) => num(r.legalLeave) },
  ];
  const absence: Col[] = [
    { label: "Sin aviso", get: (r) => num(r.unjustified) },
    { label: "Sin goce", get: (r) => num(r.unpaid) },
    { label: "Enfermedad", get: (r) => num(r.medical) },
    { label: "Accidente", get: (r) => num(r.accident) },
    { label: "Suspensión", get: (r) => num(r.suspension) },
    { label: "Otras", get: (r) => num(r.other) },
    { label: "Total ausentes", get: (r) => num(r.absent), strong: true },
  ];
  const all = [...presence, ...absence];
  const th = "px-2 py-1.5 text-right font-semibold text-foreground";

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Breadcrumb items={crumbs} />
          <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">Resumen por fecha y unidad</h1>
          <p className="text-xs text-muted-foreground">
            {dayLabel} · {groupName ? `por ${groupName.toLowerCase()}` : "total general"} · cifras en {unit}
          </p>
        </div>
        <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
      </div>

      <DateReportFilters
        from={params.from}
        to={params.to}
        groupSlug={dimensions.find((d) => d.code === params.groupBy)?.slug ?? "total"}
        groups={dimensions.map((d) => ({ slug: d.slug, name: d.name }))}
        today={today}
        dimensions={data.dimensionOptions.map((d) => ({
          ...d,
          options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
          selected: filterTokens(params.dims[d.code]),
        }))}
      />

      {data.unclassifiedTypes > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Hay tipos de ausencia sin clasificar: se cuentan en "Otras" y como ausentismo hasta que se clasifiquen.</span>
          <Link href="/settings/absence-types" className="ml-auto shrink-0 font-medium underline">
            Revisar
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">
          No hay personas con día laborable en {singleDay ? "esa fecha" : "ese período"} con los filtros aplicados.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-xs" style={{ minWidth: 1100 }}>
              <caption className="sr-only">
                Resumen de asistencia por {groupName ?? "total general"}, {dayLabel}
              </caption>
              <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                <tr className="border-b">
                  <th rowSpan={2} scope="col" className="px-2 py-1.5 text-left font-semibold text-foreground">
                    {groupName ?? "Total"}
                  </th>
                  <th rowSpan={2} scope="col" className={th}>
                    Dotación asignada
                  </th>
                  <th colSpan={presence.length} scope="colgroup" className="border-l px-2 py-1 text-center font-semibold text-foreground">
                    Presentismo
                  </th>
                  <th colSpan={absence.length} scope="colgroup" className="border-l px-2 py-1 text-center font-semibold text-foreground">
                    Ausentismo
                  </th>
                  <th rowSpan={2} scope="col" className={`${th} border-l`}>
                    % Ausentismo
                  </th>
                </tr>
                <tr className="border-b">
                  {all.map((c, i) => (
                    <th key={c.label} scope="col" className={`${th} ${i === 0 || i === presence.length ? "border-l" : ""}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-muted/40">
                    <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-foreground">
                      {r.label}
                    </th>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(r.assigned)}</td>
                    {all.map((c, i) => (
                      <td
                        key={c.label}
                        className={`px-2 py-1.5 text-right tabular-nums ${c.strong ? "font-semibold" : ""} ${i === 0 || i === presence.length ? "border-l" : ""}`}
                      >
                        {c.get(r)}
                      </td>
                    ))}
                    <td className="border-l px-2 py-1.5 text-right font-semibold tabular-nums">{r.pct === null ? "—" : fmtPct(r.pct)}</td>
                  </tr>
                ))}
              </tbody>
              {groupName && (
                <tfoot className="sticky bottom-0 border-t-2 bg-muted/90 font-semibold backdrop-blur">
                  <tr>
                    <th scope="row" className="px-2 py-1.5 text-left">
                      {total.label}
                    </th>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(total.assigned)}</td>
                    {all.map((c, i) => (
                      <td key={c.label} className={`px-2 py-1.5 text-right tabular-nums ${i === 0 || i === presence.length ? "border-l" : ""}`}>
                        {c.get(total)}
                      </td>
                    ))}
                    <td className="border-l px-2 py-1.5 text-right tabular-nums">{total.pct === null ? "—" : fmtPct(total.pct)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          La dotación asignada son las personas con día laborable según su turno (o el horario de la empresa). Los presentes son una
          <strong> estimación</strong>: dotación menos francos, vacaciones, licencias y ausentes; los presentes reales requieren asistencia detallada.
          {singleDay ? " Una persona con más de un evento ese día se cuenta una vez." : " En un período se suman personas-día y las ausencias parciales cuentan como fracción de día."}{" "}
          % de ausentismo = ausentes ÷ dotación asignada.
        </span>
      </p>
    </DashboardShell>
  );
}
