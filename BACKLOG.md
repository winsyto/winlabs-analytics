# WinLabs Analytics — Backlog

> Fuente de verdad del trabajo activo. Actualizar al iniciar y cerrar cada tarea.
> Para visión macro ver `proyecto/07-roadmap.md`.
> Para contexto técnico ver `CLAUDE.md`.
>
> **Estados:** `[ ]` pendiente · `[~]` en progreso · `[x]` hecho · `[-]` descartado/diferido

---

## M0 — Setup y spine ✅ CERRADO

<details>
<summary>Ver tareas completadas</summary>

- [x] Monorepo Turborepo + pnpm con apps `cmp` y `cliente`
- [x] shadcn/ui en `packages/ui` + Tailwind tokens
- [x] CI básico (lint + typecheck + build) en GitHub Actions
- [x] PostgreSQL local + Supabase + variables de entorno
- [x] Prisma schema inicial: `tenants`, `users`, `internal_users`, `roles`, `user_roles`, `audit_log`
- [x] RLS policies en todas las tablas de tenant
- [x] Helper `withTenantContext` en `packages/auth`
- [x] Tests RLS con Vitest (6 tests, BD real, corre en CI)
- [x] NextAuth v5 en CMP (internal users) y Cliente (tenant users)
- [x] Middleware de auth (`proxy.ts`) en ambas apps
- [x] Sistema de permisos `assertCan` / `canPerform` en `packages/auth`
- [x] Seed de desarrollo (2 tenants, 5 usuarios)
- [x] Deploy en Vercel (cmp + cliente, dominio `winlabs.com.ar`)
- [x] Sentry v9 configurado en ambas apps
- [x] Resend v4 + dominio `analytics@winlabs.com.ar` verificado
- [x] CMP: login + dashboard + gestión de tenants (`/tenants`)
- [x] Cliente: login + dashboard + sidebar con tenant name
- [x] Cliente: gestión de usuarios del tenant (`/settings/users`) con permisos por rol
- [x] Playwright E2E smoke tests (12 tests, corre en CI)
- [x] `CLAUDE.md` y `BACKLOG.md` para contexto de Claude Code

</details>

---

## PRE-M1 — Organización técnica ✅ CERRADO

- [x] `CLAUDE.md` raíz + por app/package
- [x] `BACKLOG.md` estructurado
- [x] Skills en `.claude/skills/` (add-table, add-crud, add-integration, add-dashboard, generate-docs)
- [x] DBML inicial + docs/database/changelog.md

---

## UI/UX — Rediseño AppShell 🔄 PRÓXIMO (primera sesión Claude Code)

> Implementar el diseño basado en AI-GEO-platform con primary azul y Geist Sans.
> **Spec completa:** `proyecto/iniciativa/ui-ux-spec.md`
> **Antes de empezar:** leer `CLAUDE.md`, esta sección, y la spec de UI/UX.

### UI-1: Tokens y tipografía base ✅
- [x] Instalar `geist` en `apps/cmp` y `apps/cliente`
- [x] Actualizar `globals.css` en ambas apps con los tokens de color definidos en la spec
  - Primary: `#dc2626` (rojo), Sidebar: `#1e2530`, Topbar: `#2c3540`, Background: `#f6f7f5`
  - Active nav bg: `#fff1f1`, Active nav fg: `#1e2530`
  - Variables CSS: `--sidebar`, `--topbar`, `--sidebar-border`, `--sidebar-active-bg`, etc.
- [x] Configurar Geist Sans como fuente base en ambas apps
- [x] typecheck verde en ambas apps

### UI-2: Login pages (split layout) ✅
- [x] Rediseñar `apps/cliente/app/login/page.tsx` con split layout (hero izq + form der)
  - Hero: fondo oscuro `#1a1f24`, logo `WL` azul, headline, 2 KPI preview cards
  - Form: eyebrow azul "Acceso seguro", título, subtítulo, 3 campos, botón azul full-width
- [x] Rediseñar `apps/cmp/app/login/page.tsx` con split layout (hero izq + form der)
  - Igual pero con eyebrow "Console interna WinLabs" y solo 2 campos (email + password)
- [x] Login responsive: en mobile el hero se oculta, solo queda el form
- [x] typecheck verde en ambas apps

### UI-3: AppShell — sidebar + topbar ✅
- [x] Crear componentes en `packages/ui/src/components/layout/`:
  - `sidebar-nav.tsx` — dark sidebar con logo, nav items, footer usuario
  - `topbar.tsx` — dark topbar con tenant switcher + notif + user menu
- [x] Actualizar `apps/cliente/app/(dashboard)/layout.tsx` con los nuevos componentes
  - Sidebar colapsado por default (64px iconos) / expandido (220px con labels)
  - Toggle hamburguesa/flecha para expandir/colapsar
  - Item activo: bg `#fff1f1`, texto `#1e2530`, font-weight 600
  - **Sin footer de usuario en sidebar**
  - Topbar: TenantSwitcher + Bell + UserMenu (avatar + nombre + dropdown con logout)
- [x] Actualizar `apps/cmp/app/(dashboard)/layout.tsx` con los nuevos componentes
  - Sidebar colapsado por default, nav: Dashboard, Tenants, Usuarios internos
  - Topbar: Bell + UserMenu (sin TenantSwitcher en CMP)
- [x] typecheck verde en ambas apps

### UI-4: Componentes base del design system ✅
- [x] `PageHeader` en `packages/ui` — eyebrow (color primary) + title + slot actions
- [x] `KpiCard` en `packages/ui` — label muted + valor grande + delta con color
- [x] `EmptyState` en `packages/ui` — icon Lucide + texto + CTA opcional
- [x] Actualizar página `/dashboard` del cliente usando `KpiCard` y `EmptyState`
- [x] Actualizar página `/tenants` del CMP usando `PageHeader`
- [x] typecheck verde en ambas apps

### UI-5: Validación final ✅
- [x] Correr smoke tests E2E: `pnpm --filter @wla/e2e e2e`
- [x] Revisar visualmente en browser: login cliente, login CMP, dashboard cliente, dashboard CMP, /tenants
- [x] Commit: `feat(ui): AppShell rediseño — Geist Sans, split login, dark sidebar`

---

## M1 — Modelo de datos + framework de integraciones

> **Objetivo:** schema completo del MVP en BD + framework genérico de workers.
> **Checkpoint:** puedo activar manualmente una integración en CMP, falla con un mock pero el framework anda.

### M1-A: Schema de datos (People + Time + Payroll) ✅ CERRADO

- [x] **Migración Prisma: tablas de People**
  - `hr_people` (empleado: employee_code, full_name, hire_date, status, manager_id, etc.)
  - `hr_org_units` (estructura OU genérica con parent/child — cubre áreas, posiciones, sedes, etc.)
  - `cfg_org_unit_types` (catálogo global de tipos de OU: AREA, POSITION, LOCATION, etc.)
  - `cfg_termination_reasons` (catálogo global de motivos de baja)
  - `hr_people_org_assignments` (asignación persona → org unit, histórica)
  - `hr_people_history` (snapshot mensual del estado de cada empleado)

- [x] **Migración Prisma: tablas de Time & Attendance**
  - `att_time_daily` (agregado diario por persona)
  - `att_time_daily_entries` (detalle tipado de horas — reemplaza columnas fijas)
  - `cfg_time_entry_types` (catálogo global de tipos: OVERTIME, ABSENT, HOLIDAY, etc.)
  - `att_absenteeism_events` (evento individual de ausentismo)
  - `cfg_absenteeism_types` (catálogo por tenant: enfermedad, licencia, etc.)

- [x] **Migración Prisma: tablas de Payroll**
  - `pay_periods` (período de liquidación)
  - `pay_entries` (línea de liquidación por empleado/período)
  - `pay_concepts` (catálogo de conceptos por tenant)

- [x] **RLS policies** con `FORCE ROW LEVEL SECURITY` para todas las tablas de tenant
- [x] **Tests RLS** — 4 tests nuevos M1 + 6 M0 = 10 en total, pasando en CI
- [x] Seed de catálogos globales: `cfg_org_unit_types` (5) y `cfg_time_entry_types` (7) — aplicados en prod y dev
- [x] Aplicar migraciones en Supabase (prod)

### M1-B: Tablas de integración ✅ CERRADO

- [x] **Migración Prisma: tablas de integraciones**
  - `int_templates` (catálogo global sin RLS: file_people, file_time, file_absenteeism, file_payroll, api_manu, api_geovictoria)
  - `int_tenant_integrations` (integraciones activas por tenant + config JSON)
  - `int_runs` (historial de ejecuciones con contadores de filas)
  - `int_run_errors` (errores y warnings a nivel de fila por run)

- [x] RLS policies con FORCE ROW LEVEL SECURITY para las 3 tablas de tenant
- [x] 4 tests RLS nuevos — 14 tests en total, todos pasando
- [x] Seed de 6 templates en int_templates (4 file + api_manu + api_geovictoria)

### CMP — Gestión de usuarios por tenant ✅ CERRADO

- [x] CRUD de usuarios: crear, activar/desactivar, eliminar, resetear contraseña
- [x] Emails transaccionales: bienvenida y reset con contraseña temporal (Resend)
- [x] Política `mustChangePassword`: redirige a `/change-password` post-creación o reset
- [x] Cliente: página `/change-password` standalone + server action que limpia el flag y cierra sesión
- [x] Migración: columna `must_change_password` en tabla `users`

### M1-C: CMP — UI de modelo de datos ✅ CERRADO

- [x] **Página `/data-models`** en CMP
  - Tabla tenants × módulos (People, Time, Payroll) con badges ON/OFF
  - Dialog editable por tenant con checkboxes
  - Server action `updateTenantModulesAction` (Zod + revalidatePath)
  - Campo `active_modules String[]` agregado a tabla `tenants` (migración `add_tenant_active_modules`)
  - Fix: session callback en `apps/cmp/auth.ts` para propagar `session.user.id = token.sub`
  - Nav item "Modelos de datos" en sidebar CMP

### M1-D: CMP — UI de integraciones ✅ CERRADO

- [x] **Página `/integrations`** en CMP
  - Tabla global con todas las integraciones de todos los tenants
  - Filtro por tenant (client-side)
  - Dialog "Nueva integración": selector tenant + template + nombre
  - Server action `createTenantIntegrationAction` (withTenantContext)
  - Nav item "Integraciones" en sidebar CMP

- [x] **Página `/integrations/[tenantIntegrationId]?tenantId=xxx`** en CMP
  - Header con nombre, status badge, botón Pausar/Activar
  - Info grid: schedule, último run, último éxito, fecha creación
  - Historial de runs (últimos 50): estado, tipo, duración, filas leídas/OK/errores
  - Server action `toggleIntegrationStatusAction`
  - Server action `deleteIntegrationAction` con confirmación en UI
  - Dropdown "•••" en tabla con opciones Ver detalle / Eliminar

- [x] **Fixes post-testing**
  - Templates corregidos: `api_manu` → `api_mandu_visma_hr` + nuevo `api_mandu_visma_full` (HR + Liquidaciones)
  - Seed actualizado: `prod-catalog.ts` separado del seed de dev
  - Supabase actualizado: migraciones M1 + catálogo de templates aplicados en prod

- [x] **CI/CD** (resuelto en paralelo a M1-D)
  - Vercel Build Command: `pnpm --filter @wla/db db:migrate:deploy && turbo build`
  - GitHub Actions simplificado: solo RLS Integration Tests (lint/typecheck/build → Vercel)
  - Node.js actualizado a 24 en CI (20 deprecado en runners)
  - CLAUDE.md: reglas de migraciones, seeds y CI/CD actualizadas

### M1-E: Worker framework (VPS) ✅ CERRADO

> Arquitectura definida en `proyecto/iniciativa/estrategia_workers_jobs_integraciones.md`
> Deploy target: **Fly.io** (región GRU — São Paulo)

- [x] **Migración Prisma: tablas de jobs** (`20261001160622_add_job_tables`)
  - `jobs` — cola de trabajos con locking, heartbeat, retries, run_key
  - `job_runs` — historial de ejecuciones por intento
  - `job_events` — log detallado de ciclo de vida
  - `job_checkpoints` — cursor de posición incremental

- [x] **Setup inicial del worker en `jobs/worker/`**
  - `Dockerfile` + `docker-compose.yml`
  - `fly.toml` — deploy Fly.io región GRU
  - Scheduler loop: crea jobs `hello_world` para integraciones con `schedule_cron` activo
  - Processor loop: toma jobs con `FOR UPDATE SKIP LOCKED`, ejecuta handler
  - Heartbeat (configurable, default 30s) + recovery de jobs stale (cada 5min)
  - Graceful shutdown (SIGTERM/SIGINT)

- [x] **Handler mock `hello_world`** — loguea y completa (valida el framework end-to-end)

- [x] **Deploy del worker en Fly.io**
  - App `wla-worker` en región GRU (São Paulo)
  - `DATABASE_URL` seteado como secret en Fly.io
  - `fly deploy` exitoso — imagen Docker 54MB

- [x] **Checkpoint M1-E**: job `hello_world` procesado end-to-end en prod ✓
  - `job claimed → Hello from WLA worker! → job completed (501ms)`

---

## M2 — Integraciones file-based

> **Objetivo:** subir un XLS y ver datos cargados en BD.
> **Checkpoint:** subo XLS de people/time/absenteeism/payroll, se cargan en BD, veo el run en UI.
> **Storage:** Cloudflare R2 (S3-compatible). Bucket `integration-files`. Path: `{tenantId}/{integrationId}/{timestamp}_{filename}`.
> **Package storage:** `packages/storage` — `@wla/storage` con presigned URLs + download helper.

- [x] M2-1: Seed catálogos `cfg_org_unit_types` (5) y `cfg_time_entry_types` (7) — prod y dev
- [ ] M2-2: Configurar bucket R2 en Cloudflare + secrets en Fly.io y Vercel
  - Bucket: `integration-files` (privado)
  - Secrets worker: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
  - Secrets Vercel (apps/cliente): mismas 4 vars
- [x] M2-3: Parser `file_people` en worker (CSV + XLSX via ExcelJS, config-driven mapping)
  - `jobs/worker/src/handlers/filePeople/` — parser, upsert, tipos
  - `packages/storage/` — `@wla/storage` con presigned URLs
  - Handler registrado en `handlers/index.ts`, JobHandler recibe pool
- [x] M2-4: UI Cliente — upload de archivo por integración (presigned URL → R2 directo desde browser → crea job)
  - `/integrations` — lista integraciones file del tenant
  - `/integrations/[id]` — zona de upload + historial de jobs
  - `@wla/storage` registrado como dep en apps/cliente
- [x] M2-5: UI Cliente — historial de runs + detalle de errores por fila
- [x] Template `file_time_attendance`: parser → upsert a `time_daily`
- [x] Template `file_absenteeism`: parser → upsert a `absenteeism_events`
- [x] Template `file_payroll`: parser → upsert a `payroll_*`
- [ ] Job mensual de snapshot `people_history`

---

## M2.1 — Bug fixes y UX polish CMP + Cliente

> **Objetivo:** corregir bugs de producción y pulir UX de CMP antes de avanzar a M3.

- [x] **B1** · Fix listado integraciones CMP: agregar `tenantId` explícito al `where` del `findMany` (root cause de bugs "crea/borra para todos los tenants")
- [x] **T1** · CMP Tenants: botón inactivar/activar tenant (soft delete reversible)
- [x] **T2** · CMP Tenants: eliminar tenant con hard delete + cascada + modal de confirmación (escribir slug)
- [x] **DM1** · CMP Data Models: mover gestión de módulos activos dentro del detalle del tenant (eliminar página `/data-models` separada)
- [ ] **DM2** · CMP Data Models: todos los módulos activos por default al crear un tenant
- [ ] **I1** · CMP Integrations: botón activar/inactivar desde la tabla principal (la action ya existe)
- [ ] **TP1** · CMP Templates: lista read-only de templates con toggle activar/inactivar (sin create/edit)

---

## M3 — Dashboards core

> **Objetivo:** 4 dashboards funcionando contra data real.
> **Checkpoint:** cargo datos del cliente ancla y los 4 dashboards muestran info navegable.

- [ ] Dashboard 1: **Headcount / Cubo** (KPIs, drill-down por área/posición/location)
- [ ] Dashboard 2: **Ausentismos** (tasa, tipos, tendencia, ranking)
- [ ] Dashboard 3: **Horas extras** (total, distribución, alertas)
- [ ] Dashboard 4: **Turnover / Rotación** (tasa, por área, ingresos vs egresos)
- [ ] Filtros globales (período, área, location)
- [ ] Exportación PDF básica

---

## M4 — APIs Manú + Geovictoria

- [ ] Investigación + acceso a docs Manú y Geovictoria (iniciar ASAP en M1)
- [ ] Conector API Manú
- [ ] Conector API Geovictoria
- [ ] Reconciliación de identidades (tabla `people_source_ids` + UI matching)
- [ ] Cliente: vista de integraciones API (Mandú, Geovictoria) como read-only con historial de runs y errores

---

## M5 — IA e insights

- [ ] `packages/ai` con Vercel AI SDK + provider abstraction (Llama via Groq/Together)
- [ ] Tabla `ai_usage` para tracking de costos
- [ ] Insights pre-armados por dashboard
- [ ] Insights automáticos (prompt templates con métricas + contexto)
- [ ] Página de detalle de cada dashboard con insights

---

## M6 — Polish y MVP cerrado

- [ ] Bug fixes y UX polish
- [ ] Onboarding asistido del cliente ancla en producción
- [ ] Dataset demo para prospects
- [ ] Documentación operativa mínima
- [ ] 3 demos comerciales ejecutadas

---

## Deuda técnica registrada

- [ ] Implementar forgot password / reset password (stubs existen en ambas apps)
- [ ] Remover `/sentry-test` y `/api/email-test` antes de producción con clientes
- [ ] AsyncLocalStorage para inyección automática de `tenantId` en server actions (Paso 11 pendiente)
- [ ] Tests unitarios de `packages/auth/permissions.ts`
- [ ] Branded types para IDs críticos (TenantId, UserId, PersonId) — definido en convenciones, no implementado

---

## Cómo usar este archivo

**Al iniciar una sesión de trabajo:**
1. Leer esta sección y `CLAUDE.md` para recuperar contexto
2. Identificar qué tarea se va a encarar
3. Marcar con `[~]` las tareas en progreso

**Al terminar trabajo:**
1. Marcar con `[x]` las tareas completadas
2. Agregar nuevas tareas que surgieron
3. Mover deuda técnica a la sección correspondiente
