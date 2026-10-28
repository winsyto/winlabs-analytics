import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth/tenant-context";


/**
 * Cookie de sesión propia de esta aplicación. Auth.js usa el nombre de la cookie como "sal" al cifrar el JWT: con un
 * nombre distinto en cada app, una sesión de la otra no se puede descifrar aunque compartan AUTH_SECRET. En
 * producción lleva el prefijo __Secure-.
 */
const useSecureCookies = process.env.NODE_ENV === "production";
const SESSION_COOKIE = `${useSecureCookies ? "__Secure-" : ""}wla-cliente.session-token`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        tenantSlug: { label: "Tenant", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          !credentials?.tenantSlug ||
          !credentials?.email ||
          !credentials?.password
        ) {
          return null;
        }

        // Buscar tenant sin RLS (tabla tenants no tiene RLS)
        const tenant = await prisma.tenant.findUnique({
          where: { slug: credentials.tenantSlug as string },
          select: { id: true, slug: true, isActive: true },
        });

        if (!tenant || !tenant.isActive) return null;

        // Buscar usuario dentro del contexto del tenant (RLS activo)
        const user = await withTenantContext(tenant.id, async (tx) => {
          return tx.user.findFirst({
            where: {
              email: credentials.email as string,
              tenantId: tenant.id,
            },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              isActive: true,
              mustChangePassword: true,
            },
          });
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: useSecureCookies },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // Marca de aplicación: solo las sesiones creadas por el login del portal valen en el portal
        token.app = "cliente";
        // user sólo está presente en el primer login
        const u = user as typeof user & {
          tenantId: string;
          tenantSlug: string;
          mustChangePassword: boolean;
        };
        token.tenantId = u.tenantId;
        token.tenantSlug = u.tenantSlug;
        token.mustChangePassword = u.mustChangePassword;
      }
      // Un token sin la marca (por ejemplo, de otra aplicación) no es una sesión válida
      return token.app === "cliente" ? token : null;
    },
    session({ session, token }) {
      // token.sub = user.id (NextAuth lo setea automáticamente desde authorize)
      session.user.id = token.sub!;
      session.user.tenantId = token.tenantId as string;
      session.user.tenantSlug = token.tenantSlug as string;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
