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

### UI-1: Tokens y tipografía base
- [ ] Instalar `geist` en `apps/cmp` y `apps/cliente`
- [ ] Actualizar `globals.css` en ambas apps con los tokens de color definidos en la spec
  - Primary: `#2563eb`, Sidebar: `#1e2530`, Topbar: `#2c3540`, Background: `#f6f7f5`
  - Variables CSS: `--sidebar`, `--topbar`, `--sidebar-border`, `--sidebar-active-bg`, etc.
- [ ] Configurar Geist Sans como fuente base en ambas apps
- [ ] typecheck verde en ambas apps

### UI-2: Login pages (split layout)
- [ ] Rediseñar `apps/cliente/app/login/page.tsx` con split layout (hero izq + form der)
  - Hero: fondo oscuro `#1a1f24`, logo `WL` azul, headline, 2 KPI preview cards
  - Form: eyebrow azul "Acceso seguro", título, subtítulo, 3 campos, botón azul full-width
- [ ] Rediseñar `apps/cmp/app/login/page.tsx` con split layout (hero izq + form der)
  - Igual pero con eyebrow "Console interna WinLabs" y solo 2 campos (email + password)
- [ ] Login responsive: en mobile el hero se oculta, solo queda el form
- [ ] typecheck verde en ambas apps

### UI-3: AppShell — sidebar + topbar
- [ ] Crear componentes en `packages/ui/src/components/layout/`:
  - `sidebar-nav.tsx` — dark sidebar con logo, nav items, footer usuario
  - `topbar.tsx` — dark topbar con tenant switcher + notif + user menu
- [ ] Actualizar `apps/cliente/app/(dashboard)/layout.tsx` con los nuevos componentes
  - Sidebar con nav groups: Dashboards (expandible), Integraciones, Settings
  - Item activo: bg `#f0f4ff`, texto oscuro, font-weight 600
  - Footer: avatar iniciales + nombre + email truncado
- [ ] Actualizar `apps/cmp/app/(dashboard)/layout.tsx` con los nuevos componentes
  - Sidebar con nav: Dashboard, Tenants, Usuarios internos
- [ ] typecheck verde en ambas apps

### UI-4: Componentes base del design system
- [ ] `PageHeader` en `packages/ui` — eyebrow (color primary) + title + slot actions
- [ ] `KpiCard` en `packages/ui` — label muted + valor grande + delta con color
- [ ] `EmptyState` en `packages/ui` — icon Lucide + texto + CTA opcional
- [ ] Actualizar página `/dashboard` del cliente usando `KpiCard` y `EmptyState`
- [ ] Actualizar página `/tenants` del CMP usando `PageHeader`
- [ ] typecheck verde en ambas apps

### UI-5: Validación final
- [ ] Correr smoke tests E2E: `pnpm --filter @wla/e2e e2e`
- [ ] Revisar visualmente en browser: login cliente, login CMP, dashboard cliente, dashboard CMP, /tenants
- [ ] Commit: `feat(ui): AppShell rediseño — Geist Sans, split login, dark sidebar`

---

## M1 — Modelo de datos + framework de integraciones

> **Objetivo:** schema completo del MVP en BD + framework genérico de workers.
> **Checkpoint:** puedo activar manualmente una integración en CMP, falla con un mock pero el framework anda.

### M1-A: Schema de datos (People + Time + Payroll)

- [ ] **Migración Prisma: tablas de People**
  - `people` (empleado: employee_code, full_name, hire_date, status, area_id, position_id, etc.)
  - `areas` (estructura organizacional con parent/child)
  - `positions` (cargo/puesto)
  - `locations` (sede/oficina)
  - `people_history` (snapshot mensual del estado de cada empleado)

- [ ] **Migración Prisma: tablas de Time & Attendance**
  - `time_daily` (agregado diario: horas normales, extras, ausencias)
  - `absenteeism_events` (evento individual de ausentismo)
  - `absenteeism_types` (catálogo por tenant: enfermedad, licencia, etc.)

- [ ] **Migración Prisma: tablas de Payroll**
  - `payroll_periods` (período de liquidación)
  - `payroll_entries` (línea de liquidación por empleado/período)
  - `payroll_concepts` (catálogo de conceptos: sueldo básico, horas extras, etc.)

- [ ] **RLS policies** para todas las tablas nuevas
- [ ] **Tests RLS** actualizados para cubrir nuevas tablas
- [ ] Aplicar migraciones en Supabase (prod)

### M1-B: Tablas de integración

- [ ] **Migración Prisma: tablas de integraciones**
  - `integration_templates` (catálogo global: file_people, file_time, api_manu, etc.)
  - `tenant_integrations` (qué integraciones tiene activas cada tenant + config)
  - `integration_runs` (historial de ejecuciones: status, started_at, finished_at, error)
  - `integration_run_errors` (detalle de errores por fila/registro)

- [ ] RLS policies para tablas de integración
- [ ] Seed de templates de integración (file_people, file_time_attendance, file_absenteeism, file_payroll)

### M1-C: CMP — UI de modelo de datos

- [ ] **Página `/data-models`** en CMP
  - Lista de modelos disponibles (People, Time, Payroll)
  - Activar/desactivar por tenant
  - Server action: `updateTenantDataModels`

### M1-D: CMP — UI de integraciones

- [ ] **Página `/integrations`** en CMP
  - Catálogo de templates disponibles
  - Activar integración para un tenant
  - Ver estado de `integration_runs` por tenant

- [ ] **Página `/integrations/[tenantIntegrationId]`** en CMP
  - Configuración de la integración (mapping, schedule, filtros)
  - Historial de runs con status y errores

### M1-E: Worker framework (VPS)

> Arquitectura definida en `proyecto/iniciativa/estrategia_workers_jobs_integraciones.md`

- [ ] **Migración Prisma: tablas de jobs** (del doc de estrategia)
  - `jobs` (cola de trabajos)
  - `job_runs` (historial de ejecuciones)
  - `job_events` (log detallado)
  - `integration_checkpoints` (cursor de posición)

- [ ] Setup inicial del worker en `jobs/worker/`
  - `Dockerfile`
  - Scheduler loop (crea jobs según `integration_schedules`)
  - Processor loop (toma jobs con `FOR UPDATE SKIP LOCKED`)
  - Heartbeat + recovery de jobs stale

- [ ] Job mock `hello_world` que loguea timestamp (para validar el framework)
- [ ] Deploy del worker en VPS (Docker)

---

## M2 — Integraciones file-based

> **Objetivo:** subir un XLS y ver datos cargados en BD.
> **Checkpoint:** subo XLS de people/time/absenteeism/payroll, se cargan en BD, veo el run en UI.

- [ ] Template `file_people`: parser XLS/CSV → upsert a `people` + `areas` + `positions`
- [ ] Template `file_time_attendance`: parser → upsert a `time_daily`
- [ ] Template `file_absenteeism`: parser → upsert a `absenteeism_events`
- [ ] Template `file_payroll`: parser → upsert a `payroll_*`
- [ ] UI Cliente: upload de archivos por integración
- [ ] UI Cliente: historial de `integration_runs` + detalle de errores por fila
- [ ] Job mensual de snapshot `people_history`

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
