// withTenantContext — se implementa en el Paso 9 (RLS helper)
// Placeholder para que el monorepo compile

export async function withTenantContext<T>(
  _tenantId: string,
  _fn: () => Promise<T>
): Promise<T> {
  // TODO: implementar en Paso 9 con SET LOCAL app.current_tenant_id
  throw new Error("withTenantContext: not implemented yet");
}
