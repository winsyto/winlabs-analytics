"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateTenantModulesAction,
} from "../../../data-models/_actions/data-models.actions";
import type { DataModule } from "../page";

interface TenantModulesCardProps {
  tenant: { id: string; name: string; activeModules: string[] };
  modules: readonly DataModule[];
}

export function TenantModulesCard({ tenant, modules }: TenantModulesCardProps) {
  const router = useRouter();
  const [activeModules, setActiveModules] = useState<string[]>(tenant.activeModules);
  const [, startTransition] = useTransition();

  function toggleModule(key: string) {
    const next = activeModules.includes(key)
      ? activeModules.filter((k) => k !== key)
      : [...activeModules, key];

    setActiveModules(next);

    const formData = new FormData();
    formData.set("tenantId", tenant.id);
    next.forEach((k) => formData.append("activeModules", k));

    startTransition(async () => {
      await updateTenantModulesAction({}, formData);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Módulos analíticos
      </h3>
      <div className="space-y-2">
        {modules.map((mod) => {
          const active = activeModules.includes(mod.key);
          return (
            <div
              key={mod.key}
              className={`flex items-center justify-between rounded-md px-3 py-2.5 ${
                active ? "bg-green-50 dark:bg-green-950/30" : "bg-muted/40"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{mod.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
              </div>
              <button
                onClick={() => toggleModule(mod.key)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
                  active ? "bg-green-600" : "bg-muted-foreground/30"
                }`}
                role="switch"
                aria-checked={active}
                aria-label={`${mod.label} ${active ? "activado" : "desactivado"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    active ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
