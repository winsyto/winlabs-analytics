"use client";

import { useActionState } from "react";
import { Badge, Button } from "@wla/ui";
import {
  updateUserRoleAction,
  toggleUserActiveAction,
  type UpdateUserRoleState,
  type ToggleUserState,
} from "../_actions/user.actions";

type UserWithRole = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleName: string;
};

interface UsersTableProps {
  users: UserWithRole[];
  currentUserId: string;
  canManage: boolean;
}

// Fila individual — cada una tiene su propio estado de acción
function UserRow({
  user,
  currentUserId,
  canManage,
}: {
  user: UserWithRole;
  currentUserId: string;
  canManage: boolean;
}) {
  const isSelf = user.id === currentUserId;

  const [roleState, roleAction, roleIsPending] = useActionState<
    UpdateUserRoleState,
    FormData
  >(updateUserRoleAction, {});

  const [toggleState, toggleAction, toggleIsPending] = useActionState<
    ToggleUserState,
    FormData
  >(toggleUserActiveAction, {});

  const isPending = roleIsPending || toggleIsPending;
  const error = roleState.error ?? toggleState.error;

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="h-14 px-4">
          <div>
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </td>

        <td className="h-14 px-4">
          {canManage && !isSelf ? (
            <form action={roleAction}>
              <input type="hidden" name="targetUserId" value={user.id} />
              <select
                name="newRoleName"
                defaultValue={user.roleName}
                disabled={isPending || !user.isActive}
                onChange={(e) => {
                  const form = e.target.closest("form") as HTMLFormElement;
                  form?.requestSubmit();
                }}
                className="text-sm border rounded px-2 py-1 bg-background text-foreground disabled:opacity-50"
              >
                <option value="admin">Admin</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
            </form>
          ) : (
            <Badge variant="secondary" className="capitalize">
              {user.roleName}
            </Badge>
          )}
        </td>

        <td className="h-14 px-4">
          <Badge variant={user.isActive ? "default" : "secondary"}>
            {user.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </td>

        <td className="h-14 px-4">
          {canManage && !isSelf && (
            <form action={toggleAction}>
              <input type="hidden" name="targetUserId" value={user.id} />
              <input
                type="hidden"
                name="active"
                value={user.isActive ? "false" : "true"}
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={isPending}
                className="text-xs"
              >
                {user.isActive ? "Desactivar" : "Activar"}
              </Button>
            </form>
          )}
          {isSelf && (
            <span className="text-xs text-muted-foreground">Vos</span>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={4} className="px-4 pb-2">
            <p className="text-xs text-destructive">{error}</p>
          </td>
        </tr>
      )}
    </>
  );
}

export function UsersTable({ users, currentUserId, canManage }: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">No hay usuarios en este tenant.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Usuario
            </th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Rol
            </th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Estado
            </th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              currentUserId={currentUserId}
              canManage={canManage}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
