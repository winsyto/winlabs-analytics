"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wla/ui";
import {
  createTenantIntegrationAction,
  type CreateIntegrationState,
} from "../_actions/integrations.actions";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Template {
  code: string;
  name: string;
  category: string;
  targetModel: string;
}

interface NewIntegrationDialogProps {
  tenants: Tenant[];
  templates: Template[];
}

const initialState: CreateIntegrationState = {};

const CATEGORY_LABELS: Record<string, string> = {
  file: "Archivo",
  api: "API",
};

const TARGET_LABELS: Record<string, string> = {
  people: "Personas",
  time: "Asistencia",
  payroll: "Liquidaciones",
  absenteeism: "Ausentismo",
  people_payroll: "Personas + Liquidaciones",
};

export function NewIntegrationDialog({ tenants, templates }: NewIntegrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createTenantIntegrationAction,
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
    setOpen(next);
  }

  return (
    <>
      <Button onClick={() => handleOpenChange(true)}>Nueva integración</Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva integración</DialogTitle>
            <DialogDescription>
              Activá una integración para un tenant.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4 py-2">
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant</label>
              <select
                name="tenantId"
                required
                disabled={isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccioná un tenant…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Template</label>
              <select
                name="templateCode"
                required
                disabled={isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccioná un template…</option>
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name} ({CATEGORY_LABELS[t.category] ?? t.category} ·{" "}
                    {TARGET_LABELS[t.targetModel] ?? t.targetModel})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre</label>
              <input
                type="text"
                name="name"
                required
                maxLength={100}
                placeholder="Ej: Personas Manú — mensual"
                disabled={isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
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
                {isPending ? "Creando..." : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
