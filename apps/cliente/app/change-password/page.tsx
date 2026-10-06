"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, type ChangePasswordState } from "./_actions/change-password.actions";

const initialState: ChangePasswordState = {};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.push("/login?changed=1");
    }
  }, [state.success, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-4"
            style={{ backgroundColor: "#dc2626" }}
          >
            WL
          </div>
          <h1 className="text-2xl font-bold">Cambiá tu contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta requiere que establezcas una nueva contraseña antes de continuar.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Nueva contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              disabled={isPending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            {state.fieldErrors?.password && (
              <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="passwordConfirm" className="text-sm font-medium">
              Confirmá la contraseña
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              required
              disabled={isPending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            {state.fieldErrors?.passwordConfirm && (
              <p className="text-xs text-destructive">{state.fieldErrors.passwordConfirm[0]}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}
