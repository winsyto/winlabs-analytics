import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth/tenant-context";

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
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // user sólo está presente en el primer login
        const u = user as typeof user & {
          tenantId: string;
          tenantSlug: string;
        };
        token.tenantId = u.tenantId;
        token.tenantSlug = u.tenantSlug;
      }
      return token;
    },
    session({ session, token }) {
      session.user.tenantId = token.tenantId as string;
      session.user.tenantSlug = token.tenantSlug as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
