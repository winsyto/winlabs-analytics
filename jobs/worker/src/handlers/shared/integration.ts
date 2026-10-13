import type { Pool } from "pg";
import { withTenantClient } from "./orgSchema.js";

/** Marca la última ejecución exitosa de una integración (int_tenant_integrations tiene RLS: requiere contexto de tenant). */
export async function markIntegrationSuccess(pool: Pool, tenantId: string, integrationId: number): Promise<void> {
  await withTenantClient(pool, tenantId, (client) =>
    client.query(
      `UPDATE int_tenant_integrations
       SET last_run_at = now(), last_success_at = now(), updated_at = now()
       WHERE id = $1::int`,
      [integrationId]
    )
  );
}
