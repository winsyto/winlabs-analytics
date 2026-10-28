"use client";

import { useDashboardParams } from "../../_dashboard-kit/dashboard-shell";

export interface ConceptSelectOption {
  id: number;
  code: string;
  name: string;
  className: string | null;
}

/** Selector del concepto a detallar (parámetro `c` de la URL), agrupado por clase. Vacío = cuadro de todos los conceptos. */
export function ConceptSelect({ options, value }: { options: ConceptSelectOption[]; value: number | null }) {
  const { setParams } = useDashboardParams();
  const groups = new Map<string, ConceptSelectOption[]>();
  for (const o of options) {
    const g = o.className ?? "Sin clase (no entra en el dashboard)";
    groups.set(g, [...(groups.get(g) ?? []), o]);
  }
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="concept-select" className="text-xs font-medium text-muted-foreground">
        Concepto
      </label>
      <select
        id="concept-select"
        value={value === null ? "" : String(value)}
        onChange={(e) => setParams({ c: e.target.value || null })}
        className="max-w-72 rounded-md border bg-card px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-ring"
      >
        <option value="">Todos (cuadro de conceptos)</option>
        {[...groups].map(([name, items]) => (
          <optgroup key={name} label={name}>
            {items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
