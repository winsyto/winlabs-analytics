"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, X, Check } from "lucide-react";
import {
  updateTenantInfoAction,
  type UpdateTenantInfoState,
} from "../../_actions/tenant.actions";

interface TenantInfoCardProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    userCount: number;
  };
}

const initialState: UpdateTenantInfoState = {};

export function TenantInfoCard({ tenant }: TenantInfoCardProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateTenantInfoAction, initialState);

  const prevSuccess = useRef(state.success);
  useEffect(() => {
    if (state.success && !prevSuccess.current) {
      prevSuccess.current = true;
      setEditing(false);
    }
    if (!state.success) prevSuccess.current = false;
  }, [state.success]);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Información
        </h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="tenantId" value={tenant.id} />
          {state.error && <p className="text-xs text-destructive">{state.error}</p>}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nombre</label>
            <input
              name="name"
              defaultValue={tenant.name}
              disabled={isPending}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Slug</label>
            <input
              name="slug"
              defaultValue={tenant.slug}
              disabled={isPending}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {isPending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isPending}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Nombre</dt>
            <dd className="font-medium">{tenant.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono text-xs">{tenant.slug}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Creado</dt>
            <dd>
              {new Date(tenant.createdAt).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Usuarios</dt>
            <dd>{tenant.userCount}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
