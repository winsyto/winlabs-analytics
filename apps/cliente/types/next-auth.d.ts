import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      tenantId: string;
      tenantSlug: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string;
    tenantSlug?: string;
  }
}
