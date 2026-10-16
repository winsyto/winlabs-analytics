"use client";

import { useDashboardParams } from "../../../_dashboard-kit/dashboard-shell";

interface Props {
  groupSlug: string;
  groups: { slug: string; name: string }[];
  measure: "events" | "days" | "hours";
  showAll: boolean;
}

const inputCls = "rounded-md border bg-card px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring";

/** Columnas, medida y tipos sin datos del cuadro por tipo y unidad (el resto de los filtros son los del dashboard). */
export function TypeReportControls({ groupSlug, groups, measure, showAll }: Props) {
  const { setParams } = useDashboardParams();
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Opciones del cuadro">
      <div className="flex flex-col gap-0.5">
        <label htmlFor="tr-group" className="text-[11px] font-medium text-muted-foreground">
          Columnas por
        </label>
        <select id="tr-group" value={groupSlug} onChange={(e) => setParams({ g: e.target.value })} className={inputCls}>
          {groups.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
          <option value="total">Solo total</option>
        </select>
      </div>
      <div className="flex flex-col gap-0.5">
        <label htmlFor="tr-measure" className="text-[11px] font-medium text-muted-foreground">
          Cantidad en
        </label>
        <select
          id="tr-measure"
          value={measure}
          onChange={(e) => setParams({ m: e.target.value === "events" ? null : e.target.value })}
          className={inputCls}
        >
          <option value="events">Eventos</option>
          <option value="days">Días</option>
          <option value="hours">Horas</option>
        </select>
      </div>
      <label className="mb-1 flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={showAll} onChange={(e) => setParams({ all: e.target.checked ? "1" : null })} />
        Mostrar tipos sin ausencias
      </label>
    </div>
  );
}
