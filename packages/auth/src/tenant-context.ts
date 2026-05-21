import { prisma } from "@wla/db/client";
import type { Prisma } from "@prisma/client";

/**
 * Ejecuta `fn` dentro de una transacción con RLS aplicado al tenant dado.
 *
 * Internamente hace:
 *   SET LOCAL app.current_tenant_id = '<tenantId>'
 *
 * antes de llamar a `fn`, de modo que las políticas RLS de Postgres
 * filtran automáticamente todas las queries al tenant correcto.
 *
 * @example
 * const users = await withTenantContext(tenantId, (tx) =>
 *   tx.user.findMany()
 * );
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
