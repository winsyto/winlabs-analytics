---
name: cmp-db-modeling
description: Crear o modificar tablas en la base de datos de WinLabs Analytics. Mantiene sincronía perfecta entre el diccionario de datos (DBML) y Prisma, respetando la taxonomía de prefijos y garantizando documentación viva del modelo.
---

# SKILL 7 — CMP_DB_MODELING

## Trigger

Cuando Winsy solicite **crear o modificar tablas** en la base de datos de wlA. Frases típicas:
- "Agregamos una tabla `hr_areas`"
- "Necesito un campo nuevo en `hr_people`"
- "Modificá el modelo de `int_runs`"
- "Vamos a soportar X en BD"

## Objetivo

Mantener **sincronía perfecta** entre:

- `/docs/database/wla_schema.dbml` — diccionario de datos navegable (fuente única para diseño).
- `/prisma/schema.prisma` — implementación que Prisma usa para generar cliente + migraciones.

Respetar la taxonomía de prefijos y garantizar que cada tabla y cada campo estén documentados.

## Taxonomía de prefijos (obligatoria)

| Prefijo | Dominio |
|---|---|
| `sec_` | Seguridad (usuarios, roles, permisos, sesiones, audit) |
| `wla_` | Núcleo plataforma (tenants, internal users, config global) |
| `hr_` | People Analytics |
| `att_` | Time & Attendance |
| `pay_` | Payroll |
| `int_` | Integraciones (templates, configs por tenant, runs, sources) |
| `dsh_` | Dashboards (configs, plantillas, customizaciones) |
| `ai_` | IA (usage, prompts, config por tenant) |
| `nav_` | Navegación (menú, reports) — gestión MANUAL DBA |
| `cfg_` | Catálogos estáticos |

Si un dominio nuevo entra (Finance, CRM, Ventas), inventamos un prefijo nuevo y se documenta en este skill.

## Reglas de nomenclatura (estrictas)

- **Tablas**: snake_case plural con prefijo. Ej: `hr_people`, `int_tenant_integrations`.
- **Columnas**: snake_case. Booleanos con `is_` / `has_` / `can_`.
- **PK**: `id Int @id @default(autoincrement())`. UUID **solo** en seguridad global y logs (ej. `sec_audit_log`, `int_runs`).
- **FK**: `<entidad_singular>_id`. Ej: `tenant_id`, `person_id`, `area_id`, `manager_id`.
- **Timestamps**: `created_at`, `updated_at`, `deleted_at` (si aplica soft delete).
- **Custom fields por tenant**: una columna `custom_fields JSONB` por tabla core.
- **Tenant scope**: si la tabla es tenant-scoped, lleva `tenant_id Int NOT NULL` + RLS policy.

## Reglas de documentación (estrictas)

### En DBML

- Toda **tabla** DEBE tener un bloque `Note: '...'` al final de su definición.
- Todo **campo** DEBE incluir `[note: '...']` explicando su propósito y posibles valores enum.

### En Prisma

- Toda tabla y cada campo DEBEN estar precedidos por comentario de documentación `/// Descripción` para activar IntelliSense.

## Procedimiento obligatorio

### Paso 1 — DBML primero

Editar `/docs/database/wla_schema.dbml`. Aplicar las notas descriptivas.

Ejemplo:

```dbml
Table hr_people {
  id              int           [pk, increment]
  tenant_id       int           [not null, ref: > wla_tenants.id, note: 'Tenant al que pertenece (RLS)']
  employee_code   varchar(50)   [not null, note: 'Código único del empleado por tenant. Clave natural de reconciliación.']
  first_name      varchar(100)  [not null]
  last_name       varchar(100)  [not null]
  email           varchar(255)  [note: 'Email corporativo si existe.']
  hire_date       date          [not null]
  termination_date date         [note: 'NULL mientras esté activo. Debe ser >= hire_date.']
  status          varchar(20)   [not null, default: 'active', note: 'active | inactive | on_leave']
  area_id         int           [ref: > hr_areas.id]
  position_id     int           [ref: > hr_positions.id]
  manager_id      int           [ref: > hr_people.id, note: 'FK recursiva al manager directo.']
  custom_fields   jsonb         [note: 'Extensiones por tenant. Schema validado en Console.']
  created_at      timestamptz   [not null, default: `now()`]
  updated_at      timestamptz   [not null, default: `now()`]
  deleted_at      timestamptz   [note: 'Soft delete; NULL = activo.']

  indexes {
    (tenant_id, employee_code) [unique, name: 'uq_hr_people_tenant_employee_code']
    (tenant_id, area_id)
    (tenant_id, status)
  }

  Note: 'Personas del tenant. Origen: integraciones HR. RLS por tenant_id.'
}
```

### Paso 2 — Prisma después

Reflejar el cambio en `/prisma/schema.prisma`:

- Modelo en `PascalCase singular` (ej: `HrPerson`).
- `@@map("<nombre_snake_case>")` para mapear al nombre real de la tabla.
- Cada campo con comentario `///`.
- `@map(...)` para mapear cada campo de camelCase TS a snake_case BD.

Ejemplo:

```prisma
/// Personas del tenant. Origen: integraciones HR. RLS por tenant_id.
model HrPerson {
  /// Identificador interno autoincrement
  id Int @id @default(autoincrement())

  /// Tenant al que pertenece (RLS)
  tenantId Int @map("tenant_id")
  tenant   WlaTenant @relation(fields: [tenantId], references: [id])

  /// Código único del empleado por tenant. Clave natural de reconciliación.
  employeeCode String @map("employee_code") @db.VarChar(50)

  /// Nombre
  firstName String @map("first_name") @db.VarChar(100)

  /// Apellido
  lastName String @map("last_name") @db.VarChar(100)

  /// Email corporativo (opcional)
  email String? @db.VarChar(255)

  /// Fecha de contratación
  hireDate DateTime @map("hire_date") @db.Date

  /// NULL si el empleado sigue activo
  terminationDate DateTime? @map("termination_date") @db.Date

  /// active | inactive | on_leave
  status String @default("active") @db.VarChar(20)

  /// FK a HrArea
  areaId Int? @map("area_id")
  area   HrArea? @relation(fields: [areaId], references: [id])

  /// FK a HrPosition
  positionId Int? @map("position_id")
  position   HrPosition? @relation(fields: [positionId], references: [id])

  /// FK recursiva al manager directo
  managerId Int? @map("manager_id")
  manager   HrPerson? @relation("PeopleManager", fields: [managerId], references: [id])
  reports   HrPerson[] @relation("PeopleManager")

  /// Extensiones por tenant. Schema validado en Console.
  customFields Json @default("{}") @map("custom_fields")

  /// Timestamps
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@unique([tenantId, employeeCode], name: "uq_hr_people_tenant_employee_code")
  @@index([tenantId, areaId])
  @@index([tenantId, status])
  @@map("hr_people")
}
```

### Paso 3 — Generar migración

```bash
npx prisma migrate dev --name add_hr_people
```

Esto crea `/prisma/migrations/<timestamp>_add_hr_people/migration.sql`.

### Paso 4 — RLS en la migración

Editar el archivo `migration.sql` generado y agregar al final las policies RLS (si la tabla es tenant-scoped):

```sql
ALTER TABLE hr_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hr_people
  USING (tenant_id = current_setting('app.current_tenant_id')::int)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::int);
```

> Prisma migrate aplica las migraciones en orden; las policies se aplican junto con la tabla.

### Paso 5 — Tests RLS

Crear / actualizar el test correspondiente en `packages/db/tests/rls/<tabla>.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { withTenant, db } from "../helpers";

describe("hr_people RLS", () => {
  it("does not leak rows from another tenant", async () => {
    const tenantA = await createTenantWithPerson({ tenantId: 1 });
    const tenantB = await createTenantWithPerson({ tenantId: 2 });

    const rows = await withTenant(1, () => db.hrPerson.findMany());

    expect(rows.every((r) => r.tenantId === 1)).toBe(true);
  });
});
```

### Paso 6 — Actualizar el changelog

Agregar entrada en `/docs/database/changelog.md`:

```
| 2026-06-15 | hr_people creada | PR #42 |
```

### Paso 7 — Sugerir commit

Sugerir mensaje en Conventional Commits:

```
feat(db): add hr_people table with RLS policy
```

## Errores frecuentes a evitar

- ⛔ Tocar Prisma sin actualizar el DBML primero.
- ⛔ Definir tabla nueva sin `Note:` ni `[note: '...']` por campo.
- ⛔ Olvidar `tenant_id` + RLS policy en tabla tenant-scoped.
- ⛔ Usar UUID por default; UUID solo en seguridad/logs documentados.
- ⛔ Olvidar `@@map(...)` o `@map(...)` (Prisma genera nombres en camelCase que no matchean la BD).
- ⛔ Crear índices sin pensar (cada índice tiene costo en escritura); pero sí índice en cada FK + compuesto con `tenant_id` primero en hot queries.

## Ver también

- `proyecto/10-estandares-y-skills.md` §2 y §3
- `SKILL-10-prisma-seed-and-migrate.md` para cómo seedear catálogos asociados a tablas nuevas
- `SKILL-6-generate-documentation.md` para documentar el módulo que usa la tabla
