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
- `cfg_time_entry_types` — sin RLS (catálogo global base de tipos de hora; categorías regular/overtime/overtime_na/training/holiday/absence/other)
- `cfg_tenant_time_entry_types` — RLS por tenant_id (tipos de hora de cada tenant; `att_time_daily_entries` apunta acá)
- `hr_org_units` — RLS por tenant_id
- `hr_people` — RLS por tenant_id
- `hr_people_org_assignments` — RLS por tenant_id. Asignaciones con vigencia (`valid_from`/`valid_to`), una por persona y tipo en cada momento. Fuente de verdad de la historia de unidades organizativas
- `cfg_tenant_org_unit_types` — RLS por tenant_id (tipos de unidad que usa cada tenant)
- `dsh_dimensions` — RLS por tenant_id (dimensiones por dashboard y tenant)
- `cfg_dashboards` — sin RLS (catálogo global de dashboards y los módulos de datos que requiere cada uno)
- `dsh_tenant_dashboards` — RLS por tenant_id (dashboards activos de cada tenant; `applyDefaultDashboards` activa los que cumplen los módulos)
- `hr_people_history` — RLS por tenant_id (caché mensual derivado de las asignaciones con vigencia)
- `cfg_absenteeism_types` — RLS por tenant_id. `class` (10 clases) e `is_classified`
- `cfg_absenteeism_type_defaults` — sin RLS (catálogo global de tipos de ausencia por defecto)
- `hr_shift_schedules` — RLS por tenant_id (horario de cada unidad SHIFT)
- `cfg_tenant_settings` — RLS por tenant_id (modo de asistencia, horario por defecto, formato horas/días)
- `cfg_tenant_metric_targets` — RLS por tenant_id (metas por tenant; defaults en `METRIC_TARGET_DEFAULTS`)
- `att_time_daily` — RLS por tenant_id
- `att_time_daily_entries` — RLS por tenant_id
- `att_absenteeism_events` — RLS por tenant_id
- `pay_periods` — RLS por tenant_id (mes de liquidación `AAAA-MM`)
- `pay_processes` — RLS por tenant_id (procesos de un período: mensual, quincenal, SAC, ajustes...)
- `pay_concepts` — RLS por tenant_id (`concept_type` de 13 tipos, `reference_total` gross/net, `is_classified`)
- `pay_concept_classes` — RLS por tenant_id (clases del dashboard de Payroll, seed base de 6 con `applyDefaultPayrollClasses`)
- `pay_class_rules` — RLS por tenant_id (qué entra en cada clase: por tipo o por concepto; el concepto gana)
- `pay_entries` — RLS por tenant_id (proceso × persona × concepto; `amount` con el signo de origen, `quantity` opcional)

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

## Unidades organizativas

- Catálogo global `cfg_org_unit_types` (15 tipos, `ORG_UNIT_TYPES` en `src/org-config.ts`). Cada tenant habilita los que usa y define las dimensiones de cada dashboard (se administra desde el CMP).
- `applyDefaultOrgConfig(tx, tenantId)` crea la configuración por defecto de un tenant nuevo (se llama al crear el tenant).
- La migración que agrega vigencias usa `NO FORCE ROW LEVEL SECURITY` temporal para hacer backfill entre tenants.

## Limpieza de datos de un tenant

```bash
pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme            # simulación
pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme --confirm  # ejecuta
pnpm --filter @wla/db db:cleanup:tenant:prod -- --tenant=acme --confirm  # producción
```
