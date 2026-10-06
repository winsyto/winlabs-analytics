"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Tenant } from "@wla/db";
import { Badge } from "@wla/ui";
import { MoreHorizontal, PowerOff, Power, Trash2, AlertTriangle, Pencil } from "lucide-react";
import {
  toggleTenantStatusAction,
  deleteTenantAction,
  type ToggleTenantState,
  type DeleteTenantState,
} from "../_actions/tenant.actions";

interface TenantsTableProps {
  tenants: Tenant[];
}

function DeleteTenantModal({
  tenant,
  onClose,
}: {
  tenant: Tenant;
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
        router.refresh();
        onClose();
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
              Esta acción es <strong>irreversible</strong>. Se eliminarán todos los datos del tenant{" "}
              <strong>{tenant.name}</strong>, incluyendo usuarios, roles, integraciones y todos los registros de RRHH.
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
            onChange={(e) => {
              setSlugInput(e.target.value);
              setError(null);
            }}
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

function TenantActions({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    setOpen(false);
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border bg-popover shadow-md">
              <Link
                href={`/tenants/${tenant.id}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Editar tenant</span>
              </Link>
              <div className="border-t" />
              <button
                onClick={handleToggle}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                {tenant.isActive ? (
                  <>
                    <PowerOff className="h-3.5 w-3.5 text-amber-500" />
                    <span>Inactivar tenant</span>
                  </>
                ) : (
                  <>
                    <Power className="h-3.5 w-3.5 text-green-600" />
                    <span>Activar tenant</span>
                  </>
                )}
              </button>
              <div className="border-t" />
              <button
                onClick={() => { setOpen(false); setShowDeleteModal(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar tenant</span>
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteModal && (
        <DeleteTenantModal tenant={tenant} onClose={() => setShowDeleteModal(false)} />
      )}
    </>
  );
}

export function TenantsTable({ tenants }: TenantsTableProps) {
  if (tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">
          No hay tenants creados todavía.
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          Usá el botón &ldquo;Nuevo tenant&rdquo; para crear el primero.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Slug</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Estado</th>
            <th className="h-10 px-4 text-center font-medium text-muted-foreground">Personas</th>
            <th className="h-10 px-4 text-center font-medium text-muted-foreground">Asistencia</th>
            <th className="h-10 px-4 text-center font-medium text-muted-foreground">Liquidaciones</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Creado</th>
            <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant, idx) => (
            <tr key={tenant.id} className={idx < tenants.length - 1 ? "border-b" : ""}>
              <td className="h-12 px-4 font-medium text-foreground">
                <Link href={`/tenants/${tenant.id}`} className="hover:text-primary hover:underline">
                  {tenant.name}
                </Link>
              </td>
              <td className="h-12 px-4 text-muted-foreground font-mono text-xs">{tenant.slug}</td>
              <td className="h-12 px-4">
                <Badge variant={tenant.isActive ? "default" : "secondary"}>
                  {tenant.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </td>
              {(["people", "time", "payroll"] as const).map((mod) => (
                <td key={mod} className="h-12 px-4 text-center">
                  <Badge variant={tenant.activeModules.includes(mod) ? "default" : "secondary"} className="text-xs">
                    {tenant.activeModules.includes(mod) ? "ON" : "OFF"}
                  </Badge>
                </td>
              ))}
              <td className="h-12 px-4 text-muted-foreground">
                {new Date(tenant.createdAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="h-12 px-4 text-right">
                <TenantActions tenant={tenant} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
