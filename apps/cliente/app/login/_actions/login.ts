"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  try {
    await signIn("credentials", {
      tenantSlug: formData.get("tenantSlug") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/",
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Organización, email o contraseña incorrectos.";
        default:
          return "Ocurrió un error al iniciar sesión. Intentá de nuevo.";
      }
    }
    // Re-lanzar el error de redirect (NEXT_REDIRECT) para que Next.js lo procese
    throw error;
  }
}
