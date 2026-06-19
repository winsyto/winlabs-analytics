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
      <div className="space-y-1.5">
        <Label htmlFor="tenantSlug" className="text-xs font-medium">
          Organización
        </Label>
        <Input
          id="tenantSlug"
          name="tenantSlug"
          type="text"
          placeholder="mi-empresa"
          required
          autoComplete="organization"
          className="h-10 text-sm"
          style={{ borderRadius: "6px" }}
        />
        <p className="text-xs text-muted-foreground">
          El identificador de tu organización (ej: acme, globo-corp).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-medium">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="usuario@empresa.com"
          required
          autoComplete="email"
          className="h-10 text-sm"
          style={{ borderRadius: "6px" }}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-xs font-medium">
            Contraseña
          </Label>
          <a
            href="/forgot-password"
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: "#dc2626", fontSize: "11px" }}
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
          className="h-10 text-sm"
          style={{ borderRadius: "6px" }}
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        className="w-full h-10 font-semibold"
        style={{ backgroundColor: "#dc2626", borderRadius: "6px" }}
        disabled={isPending}
      >
        {isPending ? "Ingresando..." : "Entrar"}
      </Button>
    </form>
  );
}
