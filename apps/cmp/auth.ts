import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@wla/db/client";


/**
 * Cookie de sesión propia de esta aplicación. Auth.js usa el nombre de la cookie como "sal" al cifrar el JWT: con un
 * nombre distinto en cada app, una sesión de la otra no se puede descifrar aunque compartan AUTH_SECRET. En
 * producción lleva el prefijo __Secure-.
 */
const useSecureCookies = process.env.NODE_ENV === "production";
const SESSION_COOKIE = `${useSecureCookies ? "__Secure-" : ""}wla-cmp.session-token`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.internalUser.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
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
        token.sub = user.id;
        // Marca de aplicación: solo las sesiones creadas por el login del CMP valen en el CMP
        token.app = "cmp";
      }
      // Un token sin la marca (por ejemplo, de otra aplicación) no es una sesión válida
      return token.app === "cmp" ? token : null;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
