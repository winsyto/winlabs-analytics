"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@wla/ui";
import { Plus } from "lucide-react";
import {
  createTenantAction,
  type CreateTenantState,
} from "../_actions/tenant.actions";

const initialState: CreateTenantState = {};

export function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createTenantAction,
    initialState
  );

  // Cerrar el dialog cuando la creación es exitosa
  useEffect(() => {
    if (state.success) {
      setOpen(false);
    }
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo tenant
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear tenant</DialogTitle>
          <DialogDescription>
            Ingresá los datos del nuevo tenant y su usuario administrador.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 py-2">
          {/* Error general */}
          {state.error && (
            <p className="text-sm font-medium text-destructive">{state.error}</p>
          )}

          {/* Tenant */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del tenant
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="acme-corp"
                autoComplete="off"
                disabled={isPending}
              />
              {state.fieldErrors?.slug && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.slug[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                placeholder="Acme Corporation"
                disabled={isPending}
              />
              {state.fieldErrors?.name && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.name[0]}
                </p>
              )}
            </div>
          </div>

          {/* Admin */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Usuario administrador
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="adminName">Nombre</Label>
              <Input
                id="adminName"
                name="adminName"
                placeholder="Juan Pérez"
                disabled={isPending}
              />
              {state.fieldErrors?.adminName && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.adminName[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminEmail">Email</Label>
              <Input
                id="adminEmail"
                name="adminEmail"
                type="email"
                placeholder="admin@empresa.com"
                autoComplete="off"
                disabled={isPending}
              />
              {state.fieldErrors?.adminEmail && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.adminEmail[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminPassword">Contraseña inicial</Label>
              <Input
                id="adminPassword"
                name="adminPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isPending}
              />
              {state.fieldErrors?.adminPassword && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.adminPassword[0]}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando..." : "Crear tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
