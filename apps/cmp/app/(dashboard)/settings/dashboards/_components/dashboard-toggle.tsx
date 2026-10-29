"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardCode } from "@wla/db";
import { setTenantDashboardAction } from "../_actions/dashboards.actions";

interface Props {
  tenantId: string;
  code: DashboardCode;
  name: string;
  enabled: boolean;
  /** Nombres de los módulos de datos que faltan para poder activarlo (vacío = se puede) */
  missing: string[];
}

/**
 * Interruptor de un dashboard para un tenant. Si faltan módulos de datos no se puede activar y lo explica; un
 * dashboard ya activo siempre se puede apagar.
 */
export function DashboardToggle({ tenantId, code, name, enabled, missing }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const blocked = !value && missing.length > 0;
  const reason = blocked ? `Falta activar el módulo de datos: ${missing.join(", ")}` : null;
  const reasonId = `reason-${tenantId}-${code}`;

  function toggle() {
    const next = !value;
    setError(null);
    setValue(next);
    startTransition(async () => {
      const res = await setTenantDashboardAction({ tenantId, dashboardCode: code, enabled: next });
      if (res.error) {
        setValue(!next);
        setError(res.error);
      } else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={`${name}: ${value ? "activado" : "desactivado"}`}
        aria-describedby={reason ? reasonId : undefined}
        disabled={pending || blocked}
        onClick={toggle}
        title={reason ?? undefined}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          blocked ? "cursor-not-allowed opacity-40" : "cursor-pointer"
        } ${value ? "bg-green-600" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
      {reason && (
        <span id={reasonId} className="max-w-28 text-center text-[10px] leading-tight text-muted-foreground">
          Falta {missing.join(" y ")}
        </span>
      )}
      {error && (
        <span role="alert" className="max-w-28 text-center text-[10px] leading-tight text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
