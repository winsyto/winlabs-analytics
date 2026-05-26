"use client";

import { useActionState } from "react";
import { loginAction } from "../_actions/login";
import { Button } from "@wla/ui/components/button";
import { Input } from "@wla/ui/components/input";
import { Label } from "@wla/ui/components/label";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tenantSlug">Organización</Label>
        <Input
          id="tenantSlug"
          name="tenantSlug"
          type="text"
          placeholder="mi-empresa"
          required
          autoComplete="organization"
        />
        <p className="text-xs text-muted-foreground">
          El identificador de tu organización (ej: acme, globo-corp).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="usuario@empresa.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <a
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Ingresando..." : "Iniciar sesión"}
      </Button>
    </form>
  );
}
