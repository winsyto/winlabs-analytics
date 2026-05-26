import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Si no hay sesión, redirigir al login
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
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
