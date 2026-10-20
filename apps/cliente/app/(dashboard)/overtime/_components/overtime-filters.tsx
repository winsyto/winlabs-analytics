"use client";

import { X } from "lucide-react";
import { MultiSelectFilter } from "../../_dashboard-kit/multi-select-filter";
import { PeriodSelector } from "../../_dashboard-kit/period-selector";
import { PendingIndicator, useDashboardParams } from "../../_dashboard-kit/dashboard-shell";
import type { FilterOption } from "../_data/types";

const PERIODS = [
  { value: "month", label: "Mes actual" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "year", label: "Año en curso" },
];

export interface FilterDimension {
  code: string;
  name: string;
  slug: string;
  options: FilterOption[];
  /** ids de unidad seleccionados */
  selected: string[];
}

interface Props {
  period: string;
  dimensions: FilterDimension[];
  typeOptions: FilterOption[];
  selectedTypes: string[];
}

export function OvertimeFiltersBar({ period, dimensions, typeOptions, selectedTypes }: Props) {
  const { setParams } = useDashboardParams();
  const activeCount = dimensions.reduce((s, d) => s + d.selected.length, 0) + selectedTypes.length;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros del dashboard">
      <PeriodSelector options={PERIODS} value={period} defaultValue="month" />
      {dimensions.length > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
      {dimensions.map((d) => (
        <MultiSelectFilter key={d.code} label={d.name} paramKey={`f_${d.slug}`} options={d.options} selected={d.selected} />
      ))}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <MultiSelectFilter label="Tipo de hora" paramKey="f_type" options={typeOptions} selected={selectedTypes} />
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => setParams({ ...Object.fromEntries(dimensions.map((d) => [`f_${d.slug}`, null])), f_type: null })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpiar filtros ({activeCount})
        </button>
      )}
      <PendingIndicator />
    </div>
  );
}
