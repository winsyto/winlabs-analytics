"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wla/ui";
import {
  updateTenantModulesAction,
  type UpdateModulesState,
} from "../_actions/data-models.actions";
import type { DataModule } from "../page";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  activeModules: string[];
}

interface DataModelsTableProps {
  tenants: Tenant[];
  modules: readonly DataModule[];
}

const initialState: UpdateModulesState = {};

function EditModulesDialog({
  tenant,
  modules,
}: {
  tenant: Tenant;
  modules: readonly DataModule[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(tenant.activeModules);
  const [state, formAction, isPending] = useActionState(
    updateTenantModulesAction,
    initialState
  );

  const prevSuccess = useRef(state.success);
  useEffect(() => {
    if (state.success && !prevSuccess.current) {
      prevSuccess.current = true;
      setTimeout(() => setOpen(false), 0);
    }
    if (!state.success) prevSuccess.current = false;
  }, [state.success]);

  function handleOpenChange(next: boolean) {
    if (next) setSelected(tenant.activeModules);
    setOpen(next);
  }

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        Editar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Módulos — {tenant.name}</DialogTitle>
            <DialogDescription>
              Activá los módulos analíticos disponibles para este tenant.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4 py-2">
            <input type="hidden" name="tenantId" value={tenant.id} />

            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="space-y-3">
              {modules.map((mod) => {
                const active = selected.includes(mod.key);
                return (
                  <label
                    key={mod.key}
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      name="activeModules"
                      value={mod.key}
                      checked={active}
                      onChange={() => toggle(mod.key)}
                      disabled={isPending}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">
                        {mod.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mod.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DataModelsTable({ tenants, modules }: DataModelsTableProps) {
  if (tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No hay tenants creados.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Tenant
            </th>
            {modules.map((mod) => (
              <th
                key={mod.key}
                className="h-10 px-4 text-center font-medium text-muted-foreground"
              >
                {mod.label}
              </th>
            ))}
            <th className="h-10 px-4 text-right font-medium text-muted-foreground">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant, idx) => (
            <tr
              key={tenant.id}
              className={idx < tenants.length - 1 ? "border-b" : ""}
            >
              <td className="h-14 px-4">
                <p className="font-medium text-foreground">{tenant.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {tenant.slug}
                </p>
              </td>
              {modules.map((mod) => (
                <td key={mod.key} className="h-14 px-4 text-center">
                  {tenant.activeModules.includes(mod.key) ? (
                    <Badge variant="default" className="text-xs">ON</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">OFF</Badge>
                  )}
                </td>
              ))}
              <td className="h-14 px-4 text-right">
                <EditModulesDialog tenant={tenant} modules={modules} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
