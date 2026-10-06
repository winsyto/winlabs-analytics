"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, PowerOff, Power } from "lucide-react";
import {
  toggleTenantStatusAction,
  deleteTenantAction,
  type ToggleTenantState,
  type DeleteTenantState,
} from "../../_actions/tenant.actions";

interface TenantActionsHeaderProps {
  tenant: { id: string; slug: string; isActive: boolean };
}

function DeleteTenantModal({
  tenant,
  onClose,
}: {
  tenant: { id: string; slug: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [slugInput, setSlugInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("tenantId", tenant.id);
    formData.set("slugConfirmation", slugInput);

    startTransition(async () => {
      const result: DeleteTenantState = await deleteTenantAction({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/tenants");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Eliminar tenant</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Esta acción es <strong>irreversible</strong>. Se eliminarán todos los datos del tenant, incluyendo usuarios, roles, integraciones y registros de RRHH.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-sm text-foreground">
            Escribí{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{tenant.slug}</code>{" "}
            para confirmar:
          </label>
          <input
            type="text"
            value={slugInput}
            onChange={(e) => { setSlugInput(e.target.value); setError(null); }}
            placeholder={tenant.slug}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-destructive"
            autoComplete="off"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={slugInput !== tenant.slug || isPending}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPending ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TenantActionsHeader({ tenant }: TenantActionsHeaderProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [, startTransition] = useTransition();

  function handleToggle() {
    const formData = new FormData();
    formData.set("tenantId", tenant.id);
    formData.set("isActive", String(!tenant.isActive));

    startTransition(async () => {
      const result: ToggleTenantState = await toggleTenantStatusAction({}, formData);
      if (!result.error) router.refresh();
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          {tenant.isActive ? (
            <>
              <PowerOff className="h-3.5 w-3.5 text-amber-500" />
              Inactivar
            </>
          ) : (
            <>
              <Power className="h-3.5 w-3.5 text-green-600" />
              Activar
            </>
          )}
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>
      {showDeleteModal && (
        <DeleteTenantModal
          tenant={{ id: tenant.id, slug: tenant.slug }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}
