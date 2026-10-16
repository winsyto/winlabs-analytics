"use client";

import { X } from "lucide-react";
import { MultiSelectFilter } from "../../../_dashboard-kit/multi-select-filter";
import { PendingIndicator, useDashboardParams } from "../../../_dashboard-kit/dashboard-shell";
import type { FilterOption } from "../../_data/types";

interface FilterDim {
  code: string;
  name: string;
  slug: string;
  options: FilterOption[];
  selected: string[];
}

interface Props {
  from: string;
  to: string;
  groupSlug: string;
  groups: { slug: string; name: string }[];
  dimensions: FilterDim[];
  today: string;
}

const inputCls = "rounded-md border bg-card px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring";

export function DateReportFilters({ from, to, groupSlug, groups, dimensions, today }: Props) {
  const { setParams } = useDashboardParams();
  const active = dimensions.reduce((s, d) => s + d.selected.length, 0);

  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros del reporte">
      <div className="flex flex-col gap-0.5">
        <label htmlFor="rep-from" className="text-[11px] font-medium text-muted-foreground">
          Desde
        </label>
        <input
          id="rep-from"
          type="date"
          value={from}
          max={today}
          onChange={(e) => e.target.value && setParams({ from: e.target.value, to: to !== from && to >= e.target.value ? to : null })}
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label htmlFor="rep-to" className="text-[11px] font-medium text-muted-foreground">
          Hasta (opcional)
        </label>
        <input
          id="rep-to"
          type="date"
          value={to}
          min={from}
          max={today}
          onChange={(e) => setParams({ to: e.target.value && e.target.value !== from ? e.target.value : null })}
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label htmlFor="rep-group" className="text-[11px] font-medium text-muted-foreground">
          Filas por
        </label>
        <select id="rep-group" value={groupSlug} onChange={(e) => setParams({ g: e.target.value })} className={inputCls}>
          {groups.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
          <option value="total">Solo total general</option>
        </select>
      </div>
      <span className="mb-1 h-5 w-px bg-border" aria-hidden />
      {dimensions.map((d) => (
        <MultiSelectFilter key={d.code} label={d.name} paramKey={`f_${d.slug}`} options={d.options} selected={d.selected} />
      ))}
      {active > 0 && (
        <button
          type="button"
          onClick={() => setParams(Object.fromEntries(dimensions.map((d) => [`f_${d.slug}`, null])))}
          className="mb-0.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpiar filtros ({active})
        </button>
      )}
      <PendingIndicator />
    </div>
  );
}
