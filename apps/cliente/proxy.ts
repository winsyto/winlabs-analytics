import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default auth((req) => {
  // Si no hay sesión, redirigir al login
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  /*
   * El tenantId debería venir garantizado en el JWT por el authorize() de
   * NextAuth, pero un token emitido antes de un cambio en el callback de
   * sesión (o corrupto por otra causa) puede llegar sin tenantId. Sin este
   * chequeo, las queries de tenant más adelante fallan con un error no
   * recuperable: el usuario queda trabado sin poder ni ver el botón de logout.
   * Auto-recuperamos limpiando la cookie y mandando a /login.
   */
  if (!req.auth.user?.tenantId) {
    const response = NextResponse.redirect(new URL("/login", req.url));
    for (const name of SESSION_COOKIE_NAMES) {
      response.cookies.delete(name);
    }
    return response;
  }
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
