import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Si no hay sesión, redirigir al login
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  /*
   * El tenantId ya está garantizado en el JWT por el authorize() de NextAuth:
   * sólo se crea sesión si el tenant existe y está activo.
   * No hace falta parsearlo de la URL ni del host.
   *
   * Si en el futuro necesitamos datos extra del tenant en cada request,
   * podemos leer req.auth.user.tenantId aquí.
   */
});

export const config = {
  /*
   * Aplicar middleware a todas las rutas EXCEPTO:
   * - /api/auth/** (endpoints de NextAuth)
   * - /login       (página de login)
   * - /_next/**    (assets de Next.js)
   * - /favicon.ico
   */
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
