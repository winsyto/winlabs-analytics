# SKILL: ADD_TABLE

**Trigger:** cuando se deba agregar una tabla nueva a la BD.

**Referencia completa:** `proyecto/10-estandares-y-skills.md` §2 y §3.

---

## Procedimiento obligatorio (en orden)

### 1. Definir la tabla en DBML

Agregar la definición en `/docs/database/wla_schema.dbml`.

Reglas:
- Nombre: `<prefijo>_<plural_snake_case>` (prefijos en `CLAUDE.md`)
- Todo campo DEBE tener `[note: '...']`
- La tabla DEBE tener `Note: '...'`
- Tabla de tenant: incluir `tenant_id int [not null, ref: > tenants.id]`
- Índices: FK + compuesto con `tenant_id` primero en queries frecuentes
- Soft delete: columna `deleted_at timestamptz`

### 2. Agregar modelo en Prisma

En `packages/db/prisma/schema.prisma`:
- Modelo `PascalCase` singular (ej: `HrPerson`)
- Cada campo con comentario `///`
- `@@map("hr_example")` al final

### 3. Generar migración

```bash
pnpm --filter @wla/db db:migrate:dev
# nombre descriptivo: add_hr_example
```

Si tabla tiene RLS, agregar al final del migration.sql generado:

```sql
ALTER TABLE hr_example ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hr_example
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
```

### 4. Tests RLS

```bash
pnpm --filter @wla/db db:migrate:test
pnpm --filter @wla/db test
```

Si la tabla tiene RLS, agregar test en `packages/db/src/__tests__/rls.test.ts`.

### 5. Changelog

En `/docs/database/changelog.md`:
```
| 2026-XX-XX | Agrega hr_example (descripción) | migration_name |
```

### 6. Exportar tipo

En `packages/db/src/index.ts`:
```ts
export type { HrExample } from "@prisma/client";
```

### 7. Producción (solo con confirmación explícita)

```bash
pnpm --filter @wla/db db:migrate:prod
```

---

## Checklist

- [ ] DBML con Note y [note] en todos los campos
- [ ] Prisma con /// en todos los campos
- [ ] Migración generada y revisada
- [ ] RLS policy en el SQL (si aplica)
- [ ] Tests RLS verdes
- [ ] Changelog actualizado
- [ ] Tipo exportado desde @wla/db
