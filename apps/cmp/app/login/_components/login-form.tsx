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
        <Label htmlFor="email" className="text-xs font-medium">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="admin@winlabs.com.ar"
          required
          autoComplete="email"
          className="h-10 text-sm"
          style={{ borderRadius: "6px" }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-medium">
          Contraseña
        </Label>
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
