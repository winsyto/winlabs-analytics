"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import {
  resetOrgConfigAction,
  setDashboardDimensionsAction,
  setOrgUnitTypeEnabledAction,
} from "../_actions/org-config.actions";

export interface OrgTypeRow {
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

export interface DashboardDimensionsRow {
  code: string;
  label: string;
  dimensions: string[];
}

interface Props {
  tenantId: string;
  types: OrgTypeRow[];
  dashboards: DashboardDimensionsRow[];
}

export function TenantOrgConfigCard({ tenantId, types, dashboards }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nameOf = (code: string) => types.find((t) => t.code === code)?.name ?? code;

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      router.refresh();
    });
  }

  const saveDimensions = (dashboardCode: string, codes: string[]) =>
    run(() => setDashboardDimensionsAction({ tenantId, dashboardCode: dashboardCode as "headcount" | "absenteeism" | "overtime" | "turnover" | "payroll", typeCodes: codes }));

  const move = (d: DashboardDimensionsRow, index: number, delta: -1 | 1) => {
    const next = [...d.dimensions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    saveDimensions(d.code, next);
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-6" aria-busy={pending}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Unidades organizativas y dimensiones
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Definí qué tipos de unidad organizativa usa este tenant y cuáles son las dimensiones de cada dashboard.
            Las dimensiones son columnas obligatorias del archivo de Personas.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Restaurar los tipos habilitados y las dimensiones por defecto?")) {
              run(() => resetOrgConfigAction({ tenantId }));
            }
          }}
          className="shrink-0 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          Restaurar por defecto
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="org-types-title">
          <h4 id="org-types-title" className="mb-2 text-sm font-medium text-foreground">
            Tipos que usa el tenant
          </h4>
          <ul className="space-y-1.5">
            {types.map((t) => (
              <li
                key={t.code}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${
                  t.enabled ? "bg-green-50 dark:bg-green-950/30" : "bg-muted/40"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t.name} <span className="font-mono text-[11px] font-normal text-muted-foreground">{t.code}</span>
                  </p>
                  {t.description && <p className="truncate text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={t.enabled}
                  aria-label={`${t.name}: ${t.enabled ? "habilitado" : "deshabilitado"}`}
                  disabled={pending}
                  onClick={() =>
                    run(() => setOrgUnitTypeEnabledAction({ tenantId, typeCode: t.code, enabled: !t.enabled }))
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 ${
                    t.enabled ? "bg-green-600" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      t.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          {dashboards.map((d) => {
            const available = types.filter((t) => t.enabled && !d.dimensions.includes(t.code));
            return (
              <section key={d.code} aria-labelledby={`org-dims-${d.code}`}>
                <h4 id={`org-dims-${d.code}`} className="mb-2 text-sm font-medium text-foreground">
                  Dimensiones del dashboard {d.label}
                </h4>
                <ol className="space-y-1.5">
                  {d.dimensions.map((code, i) => (
                    <li key={code} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                      <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                      <span className="flex-1 text-sm font-medium">{nameOf(code)}</span>
                      <button
                        type="button"
                        aria-label={`Subir ${nameOf(code)} en ${d.label}`}
                        disabled={pending || i === 0}
                        onClick={() => move(d, i, -1)}
                        className="rounded p-1 hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Bajar ${nameOf(code)} en ${d.label}`}
                        disabled={pending || i === d.dimensions.length - 1}
                        onClick={() => move(d, i, 1)}
                        className="rounded p-1 hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Quitar ${nameOf(code)} de ${d.label}`}
                        disabled={pending}
                        onClick={() => saveDimensions(d.code, d.dimensions.filter((c) => c !== code))}
                        className="rounded p-1 hover:bg-muted disabled:opacity-30"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ol>

                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor={`add-dimension-${d.code}`} className="sr-only">
                    Agregar dimensión a {d.label}
                  </label>
                  <select
                    id={`add-dimension-${d.code}`}
                    disabled={pending || available.length === 0}
                    defaultValue=""
                    onChange={(e) => {
                      const code = e.target.value;
                      if (code) saveDimensions(d.code, [...d.dimensions, code]);
                      e.target.value = "";
                    }}
                    className="rounded-md border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
                  >
                    <option value="">
                      {available.length === 0 ? "No hay más tipos habilitados" : "Agregar dimensión…"}
                    </option>
                    {available.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">Máximo 6. Solo tipos habilitados.</span>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
