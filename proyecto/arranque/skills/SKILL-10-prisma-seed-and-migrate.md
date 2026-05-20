---
name: prisma-seed-and-migrate
description: Aplicar migraciones de BD y poblar catálogos iniciales en wlA. Seeds modulares e idempotentes, prohibido tocar tablas de navegación.
---

# SKILL 10 — PRISMA_SEED_AND_MIGRATE

## Trigger

- Cuando se defina una tabla nueva que requiera **datos iniciales** (catálogos `cfg_*`, `sec_roles`, `int_templates`, etc.).
- Cuando se deba aplicar un **cambio a la BD** (migración).

## Reglas de migración

- Migraciones siempre con `npx prisma migrate dev --name <nombre_descriptivo>`. Genera automáticamente la carpeta `/prisma/migrations/<timestamp>_<nombre>/`.
- Cada migración con RLS incluye, al final del SQL generado, las policies (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY; CREATE POLICY ...`).
- ⛔ NUNCA editar migraciones ya aplicadas. Si hay error, generar una migración correctiva.
- ⛔ NUNCA ejecutar `prisma migrate deploy` ni `prisma db push` contra producción sin confirmación explícita de Winsy.

## Reglas de seeding (modular e idempotente)

### ⛔ PROHIBIDO

- Usar un `prisma/seed.ts` monolítico de 500 líneas.

### ✅ OBLIGATORIO

- Archivos en `/prisma/seeds/` con **prefijo numérico** que marca orden de ejecución:

```
/prisma/seeds/
  01-cfg-tenant-statuses.ts
  02-cfg-contract-types.ts
  03-cfg-termination-reasons.ts
  04-sec-roles.ts
  05-sec-permissions.ts
  06-sec-role-permissions.ts
  07-int-templates.ts            ← catálogo de integration templates
  08-dsh-templates.ts            ← plantillas de dashboards People Analytics
  99-dev-demo-tenant.ts          ← DEV ONLY, no se corre en prod
```

- Cada archivo exporta una función. Ejemplo:

```ts
// 01-cfg-tenant-statuses.ts
import type { PrismaClient } from "@prisma/client";

export async function seedTenantStatuses(prisma: PrismaClient) {
  const data = [
    { code: "active", label: "Activo" },
    { code: "suspended", label: "Suspendido" },
    { code: "trial", label: "Trial" },
  ];

  for (const item of data) {
    await prisma.cfgTenantStatus.upsert({
      where: { code: item.code },
      update: { label: item.label },
      create: item,
    });
  }
}
```

- Inserciones DEBEN usar `upsert` o `createMany({ skipDuplicates: true })`. **100% idempotentes**.

### Orquestador

`/prisma/seed.ts` solo orquesta:

```ts
import { PrismaClient } from "@prisma/client";
import { seedTenantStatuses } from "./seeds/01-cfg-tenant-statuses";
import { seedContractTypes } from "./seeds/02-cfg-contract-types";
// ... resto

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");
  await seedTenantStatuses(prisma);
  await seedContractTypes(prisma);
  // ... resto en orden
  console.log("Seed completo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

En `package.json`:

```json
{
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

Y un script para el seed de dev demo (con el `99-*`):

```json
{
  "scripts": {
    "db:seed": "prisma db seed",
    "db:seed:dev": "tsx prisma/seed.ts && tsx prisma/seeds/99-dev-demo-tenant.ts"
  }
}
```

## Regla crítica — tablas de navegación

- ⛔ **PROHIBIDO** crear o ejecutar scripts de seed para `nav_menu` y `nav_reports`.
- Estos datos los gestiona **manualmente** el DBA / administrador del sistema.
- Los seeds quedan reservados EXCLUSIVAMENTE para catálogos estáticos:
  - `cfg_*` (estados, tipos, categorías).
  - `sec_roles`, `sec_permissions`, `sec_role_permissions`.
  - `int_templates` (catálogo de integration templates).
  - `dsh_templates` (plantillas de dashboards estándar).

## Invalidación de caché tras cambios manuales en nav_menu

`getGlobalMenu()` usa `unstable_cache` con tag `global-menu` (ver SKILL 11). Los cambios manuales en BD NO se reflejan automáticamente.

Después de modificar `nav_menu` manualmente, invalidar el caché de una de estas formas:

1. **Reiniciar el server** (`Ctrl+C` + `pnpm dev`) — solo en desarrollo.
2. **POST a `/api/admin/revalidate-menu`** (autenticado) — en producción.

⛔ El agente / desarrollador NUNCA debe asumir que el menú está actualizado sin haber invalidado el caché previamente.

## Procedimiento ante una tabla nueva con catálogo

1. **Aplicar SKILL 7** para crear la tabla (DBML + Prisma + migración + RLS).
2. **Crear el archivo de seed** en `/prisma/seeds/<orden>-<prefijo>-<nombre>.ts` con función exportada.
3. **Importar y ejecutar** desde `/prisma/seed.ts` en el orden correcto.
4. **Correr el seed** localmente: `pnpm db:seed`.
5. **Verificar** en pgAdmin que las filas aparezcan.
6. **Sugerir commit**: `feat(seed): add cfg_<tabla> initial seed`.

## Errores frecuentes a evitar

- ⛔ Seed que no es idempotente (rompe la segunda corrida).
- ⛔ Seed que toca `nav_menu` o `nav_reports`.
- ⛔ Editar una migración ya aplicada en prod.
- ⛔ Olvidar registrar el seed nuevo en `/prisma/seed.ts`.
- ⛔ Usar `INSERT` en lugar de `upsert` / `createMany skipDuplicates`.
- ⛔ Ejecutar `prisma migrate reset` accidentalmente en producción.

## Ver también

- `SKILL-7-cmp-db-modeling.md` para crear la tabla antes del seed
- `SKILL-11-performance-cache-strategy.md` para `revalidateTag` post-mutación
- `proyecto/10-estandares-y-skills.md` §10
