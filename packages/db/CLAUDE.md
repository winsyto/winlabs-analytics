# packages/db — Base de datos

Ver contexto completo en `../../CLAUDE.md`.

## Qué contiene

- Schema Prisma (`prisma/schema.prisma`)
- Cliente Prisma (`src/client.ts`)
- Seed de desarrollo (`src/seed/index.ts`)
- Tests RLS (`src/__tests__/rls.test.ts`)
- Helper de tenant context para tests (`src/test-helpers/tenant-context.ts`)

## Schema actual (M1)

Tablas M0 implementadas:
- `tenants` — sin RLS
- `internal_users` — sin RLS (usuarios del CMP)
- `users` — RLS por tenant_id
- `roles` — RLS por tenant_id
- `user_roles` — RLS por tenant_id
- `audit_log` — RLS por tenant_id

Tablas M1 implementadas:
- `cfg_org_unit_types` — sin RLS (catálogo global)
- `cfg_termination_reasons` — sin RLS (catálogo global)
- `cfg_time_entry_types` — sin RLS (catálogo global)
- `hr_org_units` — RLS por tenant_id
- `hr_people` — RLS por tenant_id
- `hr_people_org_assignments` — RLS por tenant_id
- `hr_people_history` — RLS por tenant_id
- `cfg_absenteeism_types` — RLS por tenant_id
- `att_time_daily` — RLS por tenant_id
- `att_time_daily_entries` — RLS por tenant_id
- `att_absenteeism_events` — RLS por tenant_id
- `pay_periods` — RLS por tenant_id
- `pay_concepts` — RLS por tenant_id
- `pay_entries` — RLS por tenant_id

Tablas pendientes (M1-B):
- `int_templates`, `int_tenant_integrations`, `int_runs`, `int_run_errors`

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
