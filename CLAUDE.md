# WinLabs Analytics — Contexto para Claude Code

> Leé esto al inicio de cada sesión. Es el briefing completo del proyecto.

---

## Qué es este proyecto

**WinLabs Analytics (wlA)** es una plataforma SaaS de People Analytics multi-tenant para LATAM.
Dos apps: `cmp` (console interna de WinLabs para gestionar tenants) y `cliente` (app que usa cada empresa).

**Estado actual:** M0 cerrado. Entrando a M1 (modelo de datos + framework de integraciones).
**Roadmap detallado:** ver `BACKLOG.md` en la raíz.
**Docs de producto:** ver `proyecto/` — especialmente `07-roadmap.md` y `05-modelo-datos.md`.

---

## Monorepo

```
apps/
  cmp/          → Next.js 16, port 3001 — console interna WinLabs
  cliente/      → Next.js 16, port 3000 — app de tenants
packages/
  db/           → Prisma 6 + PostgreSQL, schema, migrations, seed, RLS tests
  auth/         → NextAuth v5 helpers, withTenantContext, permissions
  ui/           → shadcn/ui components, Tailwind tokens, design system
  email/        → Resend wrapper
  config/       → tsconfig, eslint compartidos
packages/e2e/   → Playwright smoke tests
jobs/           → (vacío — workers VPS deferred a milestone de integraciones)
proyecto/       → Documentación de producto (NO tocar sin motivo)
```

---

## Stack

| Área | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript strict |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 (local dev) + Supabase (prod) |
| Auth | NextAuth v5 (Auth.js) — Credentials provider, JWT strategy |
| UI | shadcn/ui + Tailwind CSS v4 |
| Email | Resend v4 |
| Error tracking | Sentry v9 |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Build | Turborepo + pnpm workspaces |
| Deploy | Vercel (ambas apps) |
| CI | GitHub Actions |

---

## Multi-tenancy y RLS

**Este es el patrón más crítico del proyecto. Leerlo bien.**

Cada tenant tiene sus propias filas en las tablas. El aislamiento se hace via **PostgreSQL RLS**:

```ts
// SIEMPRE usar withTenantContext para queries de datos de tenant
import { withTenantContext } from "@wla/auth";

const users = await withTenantContext(tenantId, (tx) =>
  tx.user.findMany()
);
```

- `withTenantContext` abre una transacción y ejecuta `SET LOCAL app.current_tenant_id = tenantId`
- Las policies de Postgres filtran automáticamente por ese valor
- **NUNCA** hacer queries directas a tablas de tenant sin `withTenantContext`
- `tenants` e `internal_users` NO tienen RLS (son tablas de plataforma)
- Passwords se hashean **fuera** de la transacción (bcrypt es lento → timeout si va dentro)

---

## Permisos

```ts
import { assertCan, canPerform } from "@wla/auth";

// Verificar antes de ejecutar una acción sensible
assertCan(userRole, "edit", "users"); // lanza ForbiddenError si no puede

// Roles: "admin" | "analyst" | "viewer"
// Resources: "users" | "roles" | "settings" | "reports"
// Actions: "read" | "create" | "edit" | "delete"
```

---

## Sesión (NextAuth v5)

```ts
import { auth } from "@/auth";

const session = await auth();
// session.user.id        → UUID del usuario
// session.user.tenantId  → UUID del tenant (solo en apps/cliente)
// session.user.tenantSlug
// session.user.email, name
```

**Importante:** `session.user.id` viene de `token.sub` — debe mapearse explícitamente en el callback de sesión si se personaliza.

---

## Convenciones de código

- **Idioma código:** inglés. **UI:** español.
- **TypeScript strict** — no `any`, validar con Zod en todos los boundaries.
- **Server actions** viven en `_actions/` dentro del route que las usa.
- **Componentes** que necesitan estado o hooks: `"use client"` + nombre descriptivo.
- **Componentes server** por default — no agregar `"use client"` sin necesidad.
- **Importar** de `@wla/db`, `@wla/auth`, `@wla/ui` — no importar de `../../../packages/`.
- **Tipos de BD** importar de `@wla/db` (re-exporta de `@prisma/client`), no de `@prisma/client` directo.

---

## Comandos frecuentes

```bash
# Dev
pnpm --filter @wla/cmp dev          # CMP en localhost:3001
pnpm --filter @wla/cliente dev      # Cliente en localhost:3000
pnpm dev                            # Ambas apps

# Calidad
pnpm typecheck                      # Typecheck todo el monorepo
pnpm --filter @wla/cmp typecheck    # Solo CMP
pnpm --filter @wla/cliente typecheck

# Tests
pnpm --filter @wla/db test          # RLS integration tests (solo en CI — ver nota abajo)

# Base de datos — LOCAL
pnpm --filter @wla/db db:migrate:dev    # Genera y aplica migración en winlabs_analytics_dev
pnpm --filter @wla/db db:seed           # Seed de dev (tenants + usuarios de prueba + catálogo)
pnpm --filter @wla/db db:studio         # Prisma Studio

# Base de datos — PRODUCCIÓN (manual, ante cambios de schema o catálogo)
pnpm --filter @wla/db db:migrate:prod           # Aplica migraciones en Supabase (usa .env.production.local)
pnpm --filter @wla/db db:seed:prod-catalog      # Seed de catálogo en Supabase (idempotente, sin datos de dev)

# Instalar dependencias
pnpm install                        # Instalar todo
pnpm add <pkg> --filter @wla/cmp   # Agregar dep a una app
```

---

## Variables de entorno

`.env.local` en cada app (gitignoreado). Ver `.env.example` para la lista completa.

- **Local dev:** PostgreSQL local `winlabs_analytics_dev`
- **Test RLS (solo CI):** PostgreSQL `winlabs_analytics_test` — no se usa en desarrollo local
- **Producción:** Supabase — vars en Vercel y en `packages/db/.env.production.local` (gitignoreado, nunca en git)

---

## Seed de desarrollo (usuarios de prueba)

| App | Usuario | Password | Rol |
|---|---|---|---|
| CMP | winsyto.dev@gmail.com | admin123 | admin interno |
| Cliente (acme) | admin@acme.com | admin123 | admin |
| Cliente (acme) | analyst@acme.com | analyst123 | analyst |
| Cliente (acme) | viewer@acme.com | viewer123 | viewer |
| Cliente (globo) | admin@globo.com | admin123 | admin |

---

## Estructura de una página típica (patrón)

```
app/(dashboard)/[feature]/
  page.tsx                    ← Server Component: fetch data, render
  layout.tsx                  ← Si necesita sub-layout
  _actions/
    feature.actions.ts        ← "use server" — validación Zod + assertCan + withTenantContext
  _components/
    feature-table.tsx         ← "use client" si necesita estado/interacción
    feature-form.tsx
```

---

## CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)
Pipeline: lint → typecheck → build → RLS tests  
No aplica migraciones ni seeds — eso es responsabilidad de Vercel.

### Vercel (deploy automático en push a `main`)
- `winlabs-analytics-cmp.vercel.app` → apps/cmp
- `winlabs-analytics-cliente.vercel.app` → apps/cliente
- **Build Command configurado en Vercel:** `pnpm --filter @wla/db db:migrate:deploy && turbo build`  
  Esto aplica las migraciones pendientes en Supabase en cada deploy, antes de que arranque la app.
- **pnpm version** viene de `packageManager` en `package.json` — no especificar en el workflow

### Regla: migraciones y seeds siempre se aplican en Vercel
Nunca esperar a correr migraciones manualmente. Todo push a `main` que incluya migraciones las aplica automáticamente vía el Build Command de Vercel.

### Datos de catálogo en producción
Los datos de catálogo global (ej: `int_templates`, tablas `cfg_*`) se seedean manualmente con `db:seed:prod-catalog` cuando se agrega un milestone nuevo con datos de referencia. No correr `db:seed` en prod (ese script es solo para dev).

---

## Lo que NO está implementado todavía

- Workers/Jobs (VPS + Docker) — deferred a milestone de integraciones
- Forgot password / reset password (stubs existen, falta implementar con Resend)
- Modelo de datos de People/Time/Payroll (viene en M1)
- Framework de integraciones (viene en M1)
- Dashboards de analytics (viene en M3)
- IA/insights (viene en M5)

---

## Convenciones de migraciones y seeds

### Migraciones (schema)
- **Una migración por cambio lógico.** Nunca acumular cambios de varios features en una sola migración.
- Se generan con `pnpm --filter @wla/db db:migrate:dev` (Prisma crea el archivo automáticamente).
- Si la migración necesita RLS policies, se agregan manualmente al SQL generado antes de commitear.
- Se aplican en producción automáticamente en el próximo deploy (Build Command de Vercel).

### Seeds — dos tipos, nunca mezclar
| Tipo | Archivo | Cuándo correr | En prod |
|---|---|---|---|
| **Dev** | `packages/db/src/seed/index.ts` | Al hacer `db:seed` local | **NUNCA** |
| **Catálogo prod** | `packages/db/src/seed/prod-catalog.ts` | Manual, por milestone | Sí, con `db:seed:prod-catalog` |

- El seed de dev crea tenants y usuarios de prueba — no es idempotente al 100% y contiene datos que no deben ir a prod.
- El seed de catálogo contiene solo datos de referencia globales (ej: `int_templates`, `cfg_*`). Es idempotente (upsert).
- **Cuando se agregan tablas de catálogo nuevas en un milestone:** agregar los inserts al `prod-catalog.ts` Y correr `db:seed:prod-catalog` después del deploy.
- No crear un seed monolítico que crezca sin límite. Si el catálogo se hace grande, dividir en archivos por dominio dentro de `seed/`.

---

## Convenciones de BD — nombres de tablas

**Decisión D-096 / Opción C pragmática:**

Las tablas de auth/plataforma de M0 conservan sus nombres actuales (sin prefijo):
`tenants`, `users`, `roles`, `user_roles`, `internal_users`, `audit_log`

**Todas las tablas nuevas de M1 en adelante usan prefijos de dominio:**

| Prefijo | Dominio | Ejemplos |
|---|---|---|
| `hr_` | People / RRHH | `hr_people`, `hr_areas`, `hr_positions`, `hr_locations`, `hr_people_history` |
| `att_` | Time & Attendance | `att_time_daily`, `att_absenteeism_events`, `att_absenteeism_types` |
| `pay_` | Payroll | `pay_periods`, `pay_entries`, `pay_concepts` |
| `int_` | Integraciones | `int_templates`, `int_tenant_integrations`, `int_runs`, `int_run_errors` |
| `dsh_` | Dashboards | `dsh_configs`, `dsh_templates` |
| `ai_` | IA / LLM | `ai_usage`, `ai_prompt_templates`, `ai_tenant_config` |
| `cfg_` | Catálogos estáticos | `cfg_termination_reasons`, `cfg_contract_types` |

**Reglas adicionales:**
- PK: `id Int @id @default(autoincrement())` — excepto en tablas de seguridad/logs donde se usa UUID
- FK: `<entidad_singular>_id` (`tenant_id`, `person_id`, `area_id`)
- Booleanos: prefijo `is_` / `has_`: `is_active`, `has_absence`
- Timestamps: `created_at`, `updated_at`, `deleted_at` (soft delete cuando aplique)
- Columna `custom_fields Json` en tablas core del dominio para extensiones por tenant

**Para cada tabla nueva:** ver procedimiento en `.claude/skills/add-table.md`

---

## Skills activos (procedimientos reproducibles)

Estos skills definen el procedimiento **obligatorio** para operaciones frecuentes.
Están en `.claude/skills/` — leerlos antes de ejecutar la operación correspondiente.

| Skill | Trigger | Archivo |
|---|---|---|
| **ADD_TABLE** | Agregar tabla nueva a la BD | `.claude/skills/add-table.md` |
| **ADD_CRUD** | Implementar un CRUD completo | `.claude/skills/add-crud.md` |
| **ADD_INTEGRATION** | Crear un conector de integración nuevo | `.claude/skills/add-integration.md` |
| **ADD_DASHBOARD** | Agregar un dashboard nuevo | `.claude/skills/add-dashboard.md` |
| **GENERATE_DOCS** | Documentar un módulo al cerrarlo | `.claude/skills/generate-docs.md` |

**Referencia completa:** `proyecto/10-estandares-y-skills.md`

---

## Archivos de referencia clave

| Qué | Dónde |
|---|---|
| Roadmap y backlog de tareas | `BACKLOG.md` (raíz) |
| Roadmap macro (visión) | `proyecto/07-roadmap.md` |
| Modelo de datos completo | `proyecto/05-modelo-datos.md` |
| Framework de integraciones | `proyecto/06-integraciones.md` |
| Convenciones de código | `proyecto/08-convenciones.md` |
| Schema Prisma actual | `packages/db/prisma/schema.prisma` |
| Decisiones tomadas | `proyecto/DECISIONS.md` |
| Estrategia workers/jobs | `proyecto/iniciativa/estrategia_workers_jobs_integraciones.md` |
