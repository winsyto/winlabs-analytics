import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Si no hay sesión, redirigir al login
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Token corrupto: tenantId ausente — limpiar sesión y redirigir a login
  if (!req.auth.user?.tenantId) {
    const response = NextResponse.redirect(new URL("/login", req.url));
    for (const name of SESSION_COOKIE_NAMES) {
      response.cookies.delete(name);
    }
    return response;
  }

  // Política de cambio de contraseña obligatorio
  if (req.auth.user.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
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
