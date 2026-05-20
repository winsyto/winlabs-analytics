---
name: performance-cache-strategy
description: Caché y deduplicación de queries de lectura en wlA. unstable_cache + revalidateTag + React.cache. Evita cross-tenant leaks por cache mal configurado.
---

# SKILL 11 — PERFORMANCE_CACHE_STRATEGY

## Trigger

Cuando se creen **consultas de lectura (GET)** para:

- Catálogos (`cfg_*`).
- Configuraciones transversales (settings, feature flags).
- Menús (`nav_menu`).
- Cualquier query repetida en una misma vista o layout (ej. obtener `currentUser` 5 veces en distintos componentes).

## Reglas de ejecución

### 1. Datos estáticos globales: `unstable_cache`

Usá `unstable_cache` de Next.js. **Siempre con un tag claro**:

```ts
import { unstable_cache } from "next/cache";
import { prisma } from "@/packages/db";

export const getCatalogContractTypes = unstable_cache(
  async () => prisma.cfgContractType.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
  }),
  ["cfg-contract-types"],        // cache key
  { tags: ["cfg-catalogs"], revalidate: 3600 }
);
```

### 2. Revalidación: `revalidateTag` post-mutación

Toda Server Action de mutación (Create/Update/Delete) sobre estas tablas DEBE finalizar llamando a `revalidateTag('<tag>')`:

```ts
"use server";
import { revalidateTag } from "next/cache";

export async function createContractType(input: unknown) {
  const parsed = createContractTypeSchema.parse(input);
  await requireSession();
  await assertCanEditCatalogs();

  const result = await prisma.cfgContractType.create({ data: parsed });

  revalidateTag("cfg-catalogs");   // ← OBLIGATORIO

  return { ok: true, data: result };
}
```

### 3. Deduplicación en request: `React.cache`

Para consultas que se repiten múltiples veces en la misma request (ej. obtener el usuario actual desde varios componentes del mismo árbol), envolver en `React.cache`:

```ts
import { cache } from "react";
import { getServerSession } from "@/packages/auth";

export const getCurrentUser = cache(async () => {
  const session = await getServerSession();
  if (!session) return null;
  return prisma.secUser.findUnique({ where: { id: session.userId } });
});
```

Esto deduplica **dentro de la misma request** — distinto de `unstable_cache` que persiste entre requests.

## Tags estándar a registrar

| Tag | Qué invalida |
|---|---|
| `cfg-catalogs` | Mutaciones en cualquier tabla `cfg_*` |
| `global-menu` | Cambios manuales en `nav_menu` (revalidación manual, no automática) |
| `sec-roles` | Mutaciones en `sec_roles` / `sec_role_permissions` |
| `int-templates` | Mutaciones en el catálogo `int_templates` |
| `dsh-templates` | Mutaciones en `dsh_templates` |
| `tenant-<tenantId>-integrations` | Mutaciones en `int_tenant_integrations` de ese tenant |
| `tenant-<tenantId>-dashboards` | Mutaciones en `dsh_configs` de ese tenant |
| `tenant-<tenantId>-people` | Cargas / mutaciones en `hr_people` de ese tenant |

## Patrón para queries tenant-scoped cacheadas

Las queries tenant-scoped **requieren** el `tenantId` en la cache key para evitar leaks cross-tenant:

```ts
export function getTenantDashboards(tenantId: number) {
  return unstable_cache(
    async () => prisma.dshConfig.findMany({
      where: { tenantId, deletedAt: null }
    }),
    [`tenant-${tenantId}-dashboards-list`],   // ← tenantId en la key
    { tags: [`tenant-${tenantId}-dashboards`], revalidate: 600 }
  )();
}
```

⛔ **NUNCA** cachear una query tenant-scoped sin `tenantId` en la cache key.

## Anti-patterns (no negociable)

- ⛔ Cachear queries tenant-scoped sin `tenantId` en la cache key → cross-tenant leak.
- ⛔ Olvidar `revalidateTag` después de una mutación → datos viejos hasta que expire el TTL.
- ⛔ Aplicar cache a queries que cambian a cada segundo (logs, métricas en vivo, runs activos).
- ⛔ Cachear queries que devuelven datos personales sensibles si la cache key no es específica del usuario.
- ⛔ Usar `unstable_cache` para deduplicar en una sola request (ese es el rol de `React.cache`).

## Procedimiento al crear una query nueva

1. Preguntate: ¿esta query es **estática** (cambia poco), **tenant-scoped** o **dinámica** (cambia a cada request)?
2. **Estática global** (catálogo): `unstable_cache` con tag global + `revalidate` razonable.
3. **Tenant-scoped y poco volátil** (configs del tenant): `unstable_cache` con `tenantId` en la key + tag `tenant-<id>-<dominio>`.
4. **Repetida en la misma request**: `React.cache`.
5. **Dinámica** (lista de runs activos, KPIs en vivo): sin cache.
6. Si cae en 2 o 3, asegurate de que **todas las mutaciones** que tocan esas tablas llamen a `revalidateTag` correspondiente.

## Ver también

- `proyecto/10-estandares-y-skills.md` §11
- `SKILL-10-prisma-seed-and-migrate.md` para revalidación manual de `nav_menu`
