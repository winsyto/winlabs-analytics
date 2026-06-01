/**
 * Re-exporta withTenantContext para uso en tests de packages/db.
 * Evita dependencia circular con packages/auth.
 */
import { prisma } from "../client";
import type { Prisma } from "@prisma/client";

export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
