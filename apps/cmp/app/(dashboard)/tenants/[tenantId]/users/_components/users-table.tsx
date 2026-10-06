"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@wla/ui";
import { MoreHorizontal, PowerOff, Power, Trash2, KeyRound, AlertTriangle } from "lucide-react";
import {
  toggleUserStatusAction,
  deleteUserAction,
  resetPasswordAction,
  type ToggleUserState,
  type DeleteUserState,
  type ResetPasswordState,
} from "../_actions/users.actions";

interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: string[];
}

function DeleteUserModal({
  user,
  tenantId,
  onClose,
}: {
  user: { id: string; name: string };
  tenantId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const formData = new FormData();
    formData.set("tenantId", tenantId);
    formData.set("userId", user.id);
    startTransition(async () => {
      const result: DeleteUserState = await deleteUserAction({}, formData);
      if (result.error) setError(result.error);
      else { router.refresh(); onClose(); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Eliminar usuario</h2>
            <p className="text-sm text-muted-foreground mt-1">
              ¿Eliminar a <strong>{user.name}</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-destructive mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={isPending} className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
            {isPending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserActions({ user, tenantId }: { user: UserRow; tenantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [, startTransition] = useTransition();

  function handleToggle() {
    const formData = new FormData();
    formData.set("tenantId", tenantId);
    formData.set("userId", user.id);
    formData.set("isActive", String(!user.isActive));
    startTransition(async () => {
      const result: ToggleUserState = await toggleUserStatusAction({}, formData);
      if (!result.error) router.refresh();
    });
    setOpen(false);
  }

  function handleResetPassword() {
    const formData = new FormData();
    formData.set("tenantId", tenantId);
    formData.set("userId", user.id);
    startTransition(async () => {
      const result: ResetPasswordState = await resetPasswordAction({}, formData);
      if (!result.error) setResetSent(true);
    });
    setOpen(false);
  }

  return (
    <>
      {resetSent && (
        <span className="text-xs text-green-600 mr-2">Email enviado ✓</span>
      )}
      <div className="relative inline-block">
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
              <button onClick={handleToggle} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
                {user.isActive ? (
                  <><PowerOff className="h-3.5 w-3.5 text-amber-500" /><span>Inactivar</span></>
                ) : (
                  <><Power className="h-3.5 w-3.5 text-green-600" /><span>Activar</span></>
                )}
              </button>
              <div className="border-t" />
              <button onClick={handleResetPassword} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
                <KeyRound className="h-3.5 w-3.5 text-blue-500" />
                <span>Resetear contraseña</span>
              </button>
              <div className="border-t" />
              <button
                onClick={() => { setOpen(false); setShowDeleteModal(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </>
        )}
      </div>
      {showDeleteModal && (
        <DeleteUserModal
          user={{ id: user.id, name: user.name }}
          tenantId={tenantId}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}

export function UsersTable({ users, tenantId }: { users: UserRow[]; tenantId: string }) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">Sin usuarios creados todavía.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Email</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Rol</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Estado</th>
            <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, idx) => (
            <tr key={user.id} className={idx < users.length - 1 ? "border-b" : ""}>
              <td className="h-12 px-4 font-medium">{user.name}</td>
              <td className="h-12 px-4 text-muted-foreground text-xs font-mono">{user.email}</td>
              <td className="h-12 px-4">
                {user.roles.length > 0 ? (
                  <span className="text-xs capitalize">{user.roles.join(", ")}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin rol</span>
                )}
              </td>
              <td className="h-12 px-4">
                <Badge variant={user.isActive ? "default" : "secondary"}>
                  {user.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </td>
              <td className="h-12 px-4 text-right">
                <UserActions user={user} tenantId={tenantId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
