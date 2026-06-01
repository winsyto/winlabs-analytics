# packages/db — Base de datos

Ver contexto completo en `../../CLAUDE.md`.

## Qué contiene

- Schema Prisma (`prisma/schema.prisma`)
- Cliente Prisma (`src/client.ts`)
- Seed de desarrollo (`src/seed/index.ts`)
- Tests RLS (`src/__tests__/rls.test.ts`)
- Helper de tenant context para tests (`src/test-helpers/tenant-context.ts`)

## Schema actual (M0)

Tablas implementadas:
- `tenants` — sin RLS
- `internal_users` — sin RLS (usuarios del CMP)
- `users` — RLS por tenant_id
- `roles` — RLS por tenant_id
- `user_roles` — RLS por tenant_id
- `audit_log` — RLS por tenant_id

Tablas pendientes (M1):
- `people`, `people_history`, `areas`, `positions`, `locations`
- `time_daily`, `absenteeism_events`, `absenteeism_types`
- `payroll_periods`, `payroll_entries`, `payroll_concepts`
- `integration_templates`, `tenant_integrations`, `integration_runs`

## RLS

Las policies usan `current_setting('app.current_tenant_id', true)`.
Siempre usar `withTenantContext` — ver `CLAUDE.md` raíz.

## Agregar una migración

```bash
# 1. Modificar schema.prisma
# 2. Generar migración
pnpm --filter @wla/db db:migrate:dev

# 3. Aplicar en test DB
pnpm --filter @wla/db db:migrate:test

# 4. Correr tests RLS para verificar que no se rompió nada
pnpm --filter @wla/db test
```

## Tests RLS

Corren contra `winlabs_analytics_test` (BD local separada).
Crean sus propios datos y limpian al finalizar — son idempotentes.
En CI usan un servicio Postgres en GitHub Actions.
