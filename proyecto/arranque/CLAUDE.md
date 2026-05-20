# CLAUDE.md — WinLabs Analytics

> Contexto operativo para agentes (Claude Code, Cursor, etc.) que trabajen en este repo.
> Source of truth de **diseño**: `proyecto/`. Source of truth de **operación**: `docs/` (módulos, runbooks, ADRs).

---

## 1. Qué es este proyecto

**WinLabs Analytics** (alias `wl-Analytics` / `wlA`) es una plataforma SaaS multi-vertical, multi-tenant, de analytics, parametrizable por cliente. Primer vertical: People Analytics (Headcount + Ausentismos + Horas extras + Turnover). Cliente ancla: empresa de servicios eléctricos (~500 empleados).

Lee `proyecto/README.md` para el resumen ejecutivo completo.

**Fase actual:** ver `proyecto/07-roadmap.md` y `proyecto/DECISIONS.md` Open-16 (T0 efectivo).

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Framework | Next.js 15+ (App Router, Server Actions, Route Handlers) |
| Estilos | Tailwind CSS + shadcn/ui |
| Visualización | Recharts + TanStack Table |
| BD (dev) | PostgreSQL local + pgAdmin 4 |
| BD (prod/preview) | Supabase (Postgres gestionado) |
| ORM | **Prisma** (no Drizzle — ver D-095) |
| Auth | NextAuth / Auth.js |
| Multi-tenancy | Postgres shared + RLS + helper `withTenantContext` |
| Jobs / workflows | Trigger.dev v3 (tentativo — ver Open-4) |
| IA | Vercel AI SDK + Llama vía Groq/Together (default) + Anthropic/OpenAI configurables |
| Hosting | Vercel (apps) + Supabase (BD) |
| Repo | GitHub privado, monorepo con pnpm + Turborepo |
| CI/CD | GitHub Actions + Vercel autodeploy |
| Observabilidad | Sentry + Vercel Analytics |
| Email | Resend |

---

## 3. Estructura del monorepo

```
winlabs-analytics/
├── CLAUDE.md                    ← este archivo
├── .claude/
│   └── skills/                  ← skills disparados por trigger (ver §9)
├── apps/
│   ├── cliente/                 ← Next.js — UI del cliente final
│   └── console/                 ← Next.js — UI interna WinLabs
├── packages/
│   ├── db/                      ← Prisma client + queries tipadas
│   ├── ui/                      ← Design system shadcn + Tailwind tokens
│   ├── types/                   ← Tipos TS compartidos
│   ├── auth/                    ← NextAuth + helper withTenantContext + audit
│   ├── ai/                      ← LLM provider abstraction + tools.ts
│   ├── integrations/            ← Workflow runner core
│   └── config/                  ← ESLint, Prettier, tsconfig compartidos
├── jobs/
│   └── trigger/                 ← Trigger.dev workflows
├── prisma/
│   ├── schema.prisma            ← schema canónico (sincronizado con DBML)
│   ├── migrations/              ← migraciones versionadas
│   └── seeds/                   ← seeds modulares idempotentes
├── docs/
│   ├── modules/                 ← documentación por módulo (SKILL 6)
│   ├── architecture/            ← decisiones globales / ADRs grandes
│   ├── database/
│   │   ├── wla_schema.dbml      ← diccionario DBML (FUENTE ÚNICA para diseño de BD)
│   │   └── changelog.md
│   ├── runbooks/                ← procedimientos operativos
│   └── adr/                     ← Architecture Decision Records cortos
└── proyecto/                    ← documentos de diseño (no operativos)
```

---

## 4. Patrones obligatorios

### 4.1 Multi-tenancy + RLS

Toda tabla con datos del tenant lleva `tenant_id Int NOT NULL` + policy RLS estándar:

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <tabla>
  USING (tenant_id = current_setting('app.current_tenant_id')::int)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::int);
```

Todo acceso a BD pasa por `packages/db` y se envuelve en `withTenantContext(tenantId, fn)`, que ejecuta `SET LOCAL app.current_tenant_id = ...` antes de las queries.

⛔ **Nunca** queries sin tenant context para tablas tenant-scoped.

### 4.2 Validación de input

Toda Server Action / Route Handler / file parser valida con **Zod** antes de la lógica. `any` está prohibido.

### 4.3 Manejo de errores

```ts
'use server';
export async function someAction(input: unknown) {
  try {
    const parsed = someSchema.parse(input);
    await requireSession();
    await assertCanX();
    // ... lógica
    return { ok: true, data };
  } catch (err) {
    return handleActionError(err);  // helper común en packages/auth
  }
}
```

### 4.4 Server Actions > Route Handlers

Route Handlers solo para webhooks, callbacks externos, o lo que Server Actions no cubren.

### 4.5 Auditoría automática

Toda acción sensible se loguea en `sec_audit_log` via wrapper. Ver `proyecto/10-estandares-y-skills.md` §12.

### 4.6 Validaciones de seguridad obligatorias

Checklist por PR sensible:

- ✅ SQL parametrizado (Prisma)
- ✅ RLS activa + `SET LOCAL`
- ✅ Auth check explícito
- ✅ Zod en boundaries
- ✅ Sin secrets hardcoded
- ✅ PII no en logs
- ✅ Audit_log entry para acciones sensibles

Ver `proyecto/08-convenciones.md` §13 para el checklist completo.

---

## 5. Convenciones de naming

### 5.1 BD

Prefijos de tabla:

| Prefijo | Dominio |
|---|---|
| `sec_` | Seguridad (usuarios, roles, permisos, audit) |
| `wla_` | Núcleo plataforma (tenants, internal users) |
| `hr_` | People Analytics |
| `att_` | Time & Attendance |
| `pay_` | Payroll |
| `int_` | Integraciones |
| `dsh_` | Dashboards |
| `ai_` | IA (usage, tools, config) |
| `nav_` | Navegación (gestión MANUAL — ver SKILL 10) |
| `cfg_` | Catálogos estáticos |

- Tablas: snake_case plural (`hr_people`).
- Columnas: snake_case.
- Booleanos: prefijo `is_`/`has_`/`can_`.
- Timestamps: `created_at`, `updated_at`, `deleted_at`.
- PK: `id Int autoincrement` (UUID solo en seguridad/logs).
- FK: `<entidad>_id`.

Ver `proyecto/10-estandares-y-skills.md` §2 para detalles completos.

### 5.2 Código

- **Inglés** para código (variables, funciones, tipos, comentarios técnicos).
- **Español** para UI usuario final (i18n con `next-intl` desde día uno).
- Archivos React PascalCase, hooks `useThing`, utilidades camelCase.
- Branded types para IDs críticos (`TenantId`, `UserId`, `PersonId`).

Ver `proyecto/08-convenciones.md` §5 para detalles.

---

## 6. Modelo de trabajo con el agente

### 6.1 Criterios de implementación (etapas)

Cada feature se trabaja en este orden:

1. **Definir objetivo** — qué tiene que pasar al final, en una línea.
2. **Definir archivos** — qué archivos vamos a tocar / crear (antes de codear).
3. **Implementar** — escribir el código.
4. **Validar** — correr lint, type-check, tests; verificar manualmente.
5. **Documentar lo mínimo necesario** — actualizar runbook / module doc si aplica (SKILL 6).
6. **Continuar** — pasar al siguiente.

### 6.2 Cosas a evitar (no negociable)

- ⛔ Refactors grandes sin necesidad concreta.
- ⛔ Abstracciones prematuras (no crear interfaces "por si acaso").
- ⛔ Duplicación obvia — pero no "DRY" hasta tener 2 casos reales.
- ⛔ Dependencias innecesarias (cada `pnpm add` requiere justificación).
- ⛔ Lógica de dominio mezclada con UI.
- ⛔ Endpoints API cuando Server Actions alcanzan.

### 6.3 Git

- Las operaciones de Git las hace **Winsy manualmente** (`init`, `add`, `commit`, `push`).
- El agente solo **sugiere** cuándo es buen momento para commitear, con mensaje propuesto en Conventional Commits.

### 6.4 Boundaries — lo que el agente NUNCA ejecuta

- ⛔ `prisma migrate deploy` o `prisma db push` contra producción sin confirmación explícita.
- ⛔ Comandos de delete masivo en BD.
- ⛔ Despliegues a Vercel sin confirmación.
- ⛔ Tocar `nav_menu` / `nav_reports` via seed o script (gestión manual del DBA — ver SKILL 10).
- ⛔ Commits, push o cualquier operación Git que cambie estado del repo remoto.

---

## 7. Comandos comunes

```bash
# Desarrollo
pnpm install                        # instalar dependencias
pnpm dev                            # levantar todas las apps en paralelo
pnpm --filter cliente dev           # solo Cliente
pnpm --filter console dev           # solo Console

# BD (local)
npx prisma migrate dev --name <nombre>     # generar + aplicar migración local
npx prisma migrate reset                   # reset BD local (dev only)
npx prisma generate                        # regenerar Prisma client
pnpm db:seed                               # correr seeds modulares
pnpm db:seed:dev                           # incluye seed-99 de demo tenant

# BD (producción / staging)
# NUNCA ejecutar prisma migrate deploy sin confirmación explícita
# Las migraciones a Supabase corren en pipeline CI/CD

# Calidad
pnpm lint                           # ESLint
pnpm typecheck                      # tsc --noEmit en todo el monorepo
pnpm test                           # Vitest
pnpm test:rls                       # suite custom de tests RLS
pnpm test:e2e                       # Playwright

# Build
pnpm build                          # turbo build de todas las apps
```

---

## 8. Decisiones críticas a confirmar al arrancar

Antes de empezar Paso 11 del setup (middleware de tenant), confirmar:

- **Open-3**: Subdomain (`{tenant}.wla.io`) vs path-based (`app/t/{tenant}`).

Antes de empezar M4 (APIs):

- **Open-6**: acceso a docs Manú y Geovictoria; sandbox; auth model.

Antes de empezar M5 (IA):

- **Open-5**: Llama hosting — Groq vs Together vs Fireworks.

Antes del primer push:

- **T0** efectivo y dominio (subdominio de `winlabs.com.ar` o registrar nuevo).

Ver `proyecto/DECISIONS.md` para todas las decisiones abiertas con criterio de cierre.

---

## 9. Skills disponibles (`.claude/skills/`)

Los skills se disparan por **trigger** (frases o eventos). El agente DEBE aplicarlos automáticamente cuando aplique el trigger.

| Skill | Trigger principal | Propósito |
|---|---|---|
| `SKILL-6-generate-documentation` | "Documentar este módulo" / "Cerrar funcionalidad" / "Generar docs" | Generar `/docs/modules/<modulo>.md` con estructura obligatoria |
| `SKILL-7-cmp-db-modeling` | Crear o modificar tablas | DBML primero → Prisma después, con notas en ambos |
| `SKILL-9-ai-agent-tooling-integration` | Crear / modificar Server Action de mutación | Registrar Tool Definition en `packages/ai/tools.ts` |
| `SKILL-10-prisma-seed-and-migrate` | Crear tabla con datos iniciales o cambio de schema | Migración Prisma + seed modular idempotente |
| `SKILL-11-performance-cache-strategy` | Consulta de lectura repetida o catálogo | `unstable_cache` + `revalidateTag` + `React.cache` |
| `add-table` | "Agregar tabla X" | Workflow completo: DBML + Prisma + RLS + queries + tests + diccionario |
| `add-crud` | "Crear CRUD de X" | Workflow completo: tablas + queries + server actions + UI con template enterprise B2B + AI tools |

Cuando un skill aplique, NO esperes que Winsy lo invoque — disparalo vos mismo y mencionalo.

---

## 10. Documentación de referencia

Si necesitás contexto adicional, mirá en este orden:

1. `proyecto/README.md` — mapa general.
2. `proyecto/01-vision-y-negocio.md` — el "para qué".
3. `proyecto/02-alcance-y-fases.md` — qué entra al MVP.
4. `proyecto/03-arquitectura.md` — arquitectura macro.
5. `proyecto/04-stack-tecnologico.md` — stack concreto.
6. `proyecto/05-modelo-datos.md` — modelo canónico.
7. `proyecto/06-integraciones.md` — workflows ETL.
8. `proyecto/07-roadmap.md` — orden de trabajo.
9. `proyecto/08-convenciones.md` — convenciones generales de código.
10. `proyecto/09-setup-inicial.md` — checklist M0.
11. `proyecto/10-estandares-y-skills.md` — estándares cross-cutting + skills.
12. `proyecto/DECISIONS.md` — log de decisiones.

---

## 11. Última nota

Si en algún punto algo no te cierra o falta info, **decímelo** antes de codear. Prefiero perder 2 minutos clarificando que arrastrar un malentendido a 200 líneas de código.

Si tenés sugerencias para mejorar este `CLAUDE.md` durante el desarrollo, anotalas en `docs/claude-md-changelog.md` para que las apliquemos al final del sprint.
