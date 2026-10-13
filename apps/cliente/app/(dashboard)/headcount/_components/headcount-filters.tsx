"use client";

import { X } from "lucide-react";
import { MultiSelectFilter } from "../../_dashboard-kit/multi-select-filter";
import { PeriodSelector } from "../../_dashboard-kit/period-selector";
import { PendingIndicator, useDashboardParams } from "../../_dashboard-kit/dashboard-shell";
import type { HeadcountFilters } from "../_data/filters";
import type { FilterOption } from "../_data/types";

const PERIODS = [
  { value: "month", label: "Mes actual" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "year", label: "Año en curso" },
];

interface Props {
  filters: HeadcountFilters;
  options: {
    areas: FilterOption[];
    locations: FilterOption[];
    positions: FilterOption[];
    contracts: FilterOption[];
  };
}

export function HeadcountFiltersBar({ filters, options }: Props) {
  const { setParams } = useDashboardParams();
  const activeCount = filters.area.length + filters.loc.length + filters.pos.length + filters.ct.length;
  const asStr = (ids: number[]) => ids.map(String);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros del dashboard">
      <PeriodSelector options={PERIODS} value={filters.p} defaultValue="month" />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <MultiSelectFilter label="Área" paramKey="area" options={options.areas} selected={asStr(filters.area)} />
      <MultiSelectFilter label="Sede" paramKey="loc" options={options.locations} selected={asStr(filters.loc)} />
      <MultiSelectFilter label="Cargo" paramKey="pos" options={options.positions} selected={asStr(filters.pos)} />
      <MultiSelectFilter label="Contrato" paramKey="ct" options={options.contracts} selected={filters.ct} />
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => setParams({ area: null, loc: null, pos: null, ct: null })}
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
