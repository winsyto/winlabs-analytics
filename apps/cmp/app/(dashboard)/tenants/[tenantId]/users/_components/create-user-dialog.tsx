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
  Input,
  Label,
} from "@wla/ui";
import { UserPlus } from "lucide-react";
import { createUserAction, type CreateUserState } from "../_actions/users.actions";

interface Role {
  id: string;
  name: string;
}

interface CreateUserDialogProps {
  tenantId: string;
  roles: Role[];
}

const initialState: CreateUserState = {};

export function CreateUserDialog({ tenantId, roles }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createUserAction, initialState);

  const prevSuccess = useRef(state.success);
  useEffect(() => {
    if (state.success && !prevSuccess.current) {
      prevSuccess.current = true;
      setTimeout(() => setOpen(false), 0);
    }
    if (!state.success) prevSuccess.current = false;
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        <UserPlus className="h-4 w-4" />
        Nuevo usuario
      </button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            Se enviará un email con una contraseña temporal. El usuario deberá cambiarla al iniciar sesión.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 py-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" name="name" placeholder="Juan Pérez" disabled={isPending} />
            {state.fieldErrors?.name && <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="juan@empresa.com" autoComplete="off" disabled={isPending} />
            {state.fieldErrors?.email && <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roleId">Rol inicial</Label>
            <select
              id="roleId"
              name="roleId"
              disabled={isPending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.roleId && <p className="text-xs text-destructive">{state.fieldErrors.roleId[0]}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
