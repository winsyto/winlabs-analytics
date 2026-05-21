// Tipos compartidos entre apps y packages

export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export function asTenantId(id: string): TenantId {
  return id as TenantId;
}

export function asUserId(id: string): UserId {
  return id as UserId;
}
