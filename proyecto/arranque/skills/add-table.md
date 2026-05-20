---
name: add-table
description: Workflow completo para agregar una tabla nueva a wlA — DBML, Prisma, migración, RLS, queries, tests, diccionario y commit.
---

# Skill — Add Table

## Trigger

Cuando Winsy diga:

- "Agregar tabla `<nombre>`"
- "Necesito una tabla para X"
- "Crear modelo Y"

## Objetivo

Agregar una tabla nueva con todas sus piezas: diseño, schema, migración, RLS, queries tipadas, tests, documentación. **Una sola tarea cerrada** de principio a fin.

## Procedimiento (orden estricto)

### Paso 1 — Diseñar la tabla en DBML (SKILL 7)

Editar `/docs/database/wla_schema.dbml`:

- Elegir prefijo según taxonomía (`hr_`, `int_`, `dsh_`, etc.).
- Definir columnas, FKs, índices, restricciones.
- Agregar `Note:` por tabla y `[note: '...']` por campo.

### Paso 2 — Reflejar en Prisma

Editar `/prisma/schema.prisma`:

- Modelo en `PascalCase singular`.
- Comentario `/// docs` antes de cada campo y antes del modelo.
- `@map(...)` y `@@map(...)` para mapear snake_case BD ↔ camelCase TS.
- Relaciones con `@relation` (incluyendo nombre si es recursiva).
- `@@unique` y `@@index` según corresponda.

### Paso 3 — Generar la migración

```bash
npx prisma migrate dev --name add_<tabla>
```

Esto crea `/prisma/migrations/<timestamp>_add_<tabla>/migration.sql` y la aplica a la BD local.

### Paso 4 — Agregar RLS al SQL de la migración

Si la tabla es tenant-scoped, editar el `migration.sql` recién creado y **agregar al final**:

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <tabla>
  USING (tenant_id = current_setting('app.current_tenant_id')::int)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::int);
```

Si Prisma ya aplicó la migración antes de que agregues el RLS, generar una nueva migración:

```bash
npx prisma migrate dev --name enable_rls_<tabla>
```

Y poner solo las sentencias RLS en ese archivo SQL.

### Paso 5 — Crear queries tipadas en `packages/db/queries/`

Crear `packages/db/queries/<tabla>.ts` con funciones tipadas:

```ts
import { db } from "@/packages/db/client";
import type { TenantId } from "@/packages/types";

export async function listX(filters?: {...}) {
  return db.x.findMany({
    where: { deletedAt: null, ...filters },
    orderBy: { id: "asc" },
  });
}

export async function getXById(id: number) {
  return db.x.findUnique({ where: { id } });
}

export async function createX(data: ...) {
  return db.x.create({ data });
}

export async function updateX(id: number, data: ...) {
  return db.x.update({ where: { id }, data });
}

export async function softDeleteX(id: number) {
  return db.x.update({ where: { id }, data: { deletedAt: new Date() } });
}
```

> Estas queries asumen que el caller ya invocó `withTenantContext(tenantId, ...)` para tablas tenant-scoped.

### Paso 6 — Tests RLS (obligatorio para tablas tenant-scoped)

Crear `packages/db/tests/rls/<tabla>.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { withTenant, db } from "../helpers";

describe("<tabla> RLS", () => {
  it("does not leak rows from another tenant", async () => {
    await seedXForTenant(1);
    await seedXForTenant(2);

    const rows = await withTenant(1, () => db.x.findMany());

    expect(rows.every((r) => r.tenantId === 1)).toBe(true);
  });

  it("does not allow inserting with wrong tenant_id", async () => {
    await expect(
      withTenant(1, () => db.x.create({ data: { tenantId: 2, ...validData } }))
    ).rejects.toThrow();
  });
});
```

Correr: `pnpm test:rls`.

### Paso 7 — Actualizar el changelog de BD

Agregar línea en `/docs/database/changelog.md`:

```
| 2026-MM-DD | <tabla> creada (motivo breve) | PR #X |
```

### Paso 8 — Si la tabla requiere catálogo inicial (SKILL 10)

- Crear archivo en `/prisma/seeds/<orden>-<prefijo>-<tabla>.ts` con función exportada.
- Registrarlo en `/prisma/seed.ts`.
- Correr `pnpm db:seed` y verificar.

### Paso 9 — Sugerir commit

Mensaje propuesto:

```
feat(db): add <tabla> with RLS policy and tests
```

## Checklist final

- [ ] DBML editado con notas en tabla y campos.
- [ ] Prisma schema actualizado con `///` y `@map/@@map`.
- [ ] Migración generada.
- [ ] RLS policy en migración SQL (si tenant-scoped).
- [ ] Queries tipadas en `packages/db/queries/`.
- [ ] Tests RLS pasando.
- [ ] Changelog de BD actualizado.
- [ ] Seed creado y registrado (si aplica).
- [ ] Commit sugerido a Winsy.

## Errores frecuentes a evitar

- ⛔ Editar Prisma sin tocar DBML primero.
- ⛔ Olvidar la RLS policy en la migración SQL.
- ⛔ No probar el RLS (tests que confirmen aislamiento).
- ⛔ Crear queries sin `deletedAt: null` filter para soft-delete tables.
- ⛔ Olvidar `@@map` y terminar con tabla nombrada `HrPerson` en Postgres en lugar de `hr_people`.

## Ver también

- `SKILL-7-cmp-db-modeling.md`
- `SKILL-10-prisma-seed-and-migrate.md`
- `SKILL-11-performance-cache-strategy.md` si la tabla es un catálogo cacheado
