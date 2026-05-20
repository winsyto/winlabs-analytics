# 09 - Setup inicial

> Documento de Fase 6 (parte 2). Checklist secuencial para bootstrappear el monorepo y servicios el día que arranques (T0). Apunta a tener algo funcional al final del primer día / primera semana.
> Última actualización: 2026-05-19.

---

## 1. Resumen

Este documento es operativo: una lista de pasos concretos en orden. Cada paso tiene "qué hacer", "qué validar al terminar" y una nota de tiempo aproximado.

Objetivo del setup: al final de la **semana 1** tenés:

- Monorepo creado, dos apps Next.js corriendo localmente y en Vercel preview.
- Supabase con schema inicial y RLS funcional.
- NextAuth funcionando para Cliente y Console (con un usuario de prueba en cada uno).
- Trigger.dev conectado (o Supabase Edge Functions si esa fue la decisión final).
- CI/CD verde, primer deploy en producción.
- Sentry capturando errores, Resend enviando un email de prueba.

---

## 2. Antes de empezar (pre-requisitos)

### 2.1 Cuentas y servicios (tener creados antes del Paso 1)

- ☐ **Cuenta GitHub** organizacional (no personal). Plan Free OK para repo privado con 1 dev.
- ☐ **Cuenta Vercel** asociada a la org GitHub.
- ☐ **Cuenta Supabase** con un proyecto creado (free tier para empezar) — **solo para producción/staging**, no para desarrollo local.
- ☐ **Cuenta Sentry**.
- ☐ **Cuenta Resend** (transactional email).
- ☐ **Cuenta del provider de IA elegido** (Groq y/o Together.ai; mantener Anthropic/OpenAI opcionales con keys).
- ☐ **Cuenta Trigger.dev** o decisión final de ir con Supabase Edge Functions + pg_cron.

### 2.2 Entorno local

- ☐ **PostgreSQL local** instalado (versión 16+) — la BD de desarrollo corre acá, no en Supabase.
- ☐ **pgAdmin 4** como cliente gráfico para explorar y administrar la BD local.
- ☐ **Node.js 20 LTS+** y **pnpm**.

### 2.3 Decisiones a cerrar antes de codear

- ☐ Decisión final **Prisma vs Drizzle** (recomendado Drizzle, ver `04-stack-tecnologico.md` §3.2).
- ☐ Decisión final **subdomain vs path-based** para tenants.

### 2.4 Dominio (opcional, no bloquea M0)

- **Sugerencia:** usar subdominio de `winlabs.com.ar` (ej. `analytics.winlabs.com.ar` para landing, `console.analytics.winlabs.com.ar`, `app.analytics.winlabs.com.ar`).
- **Alternativa:** registrar dominio dedicado (`winlabs-analytics.com` o similar) cuando se acerque el primer cliente real.
- **No es prerequisito de M0**: el desarrollo y deploy pueden funcionar con dominios temporales `*.vercel.app`. Se resuelve el dominio cuando haga falta.

---

## 3. Día 1 — Monorepo + apps base

### Paso 1: Crear el repo

> **Nota sobre Git**: vos manejás todas las operaciones de Git manualmente (`git init`, `commit`, `push`, etc.). En esta guía aparecen como **sugerencias de cuándo es buen momento de commitear**; no son automáticas y elegís vos cuándo aplicar.

- ☐ Crear repo privado `winlabs-analytics` en GitHub (web).
- ☐ Clonar localmente (o `git init` local y configurar el `origin` después).
- ☐ Crear archivo `.gitignore` (Node + Next.js + IDE + `.env.local`).
- ☐ Crear `README.md` con descripción mínima y link a `proyecto/01-vision-y-negocio.md`.

📝 **Sugerencia de commit:** `chore: bootstrap repo with gitignore and readme` — cuando hayas creado el repo y los dos archivos base.

**Validación:** la carpeta es repo Git válido y los archivos base están listos para tu primer commit.

**Tiempo:** 15 min.

### Paso 2: Inicializar monorepo (Turborepo + pnpm)

```bash
pnpm install -g turbo
pnpm dlx create-turbo@latest .
```

- ☐ Elegir el preset "basic" o "kitchen-sink" según prefieras.
- ☐ Adaptar la estructura a la propuesta en `03-arquitectura.md`:
  ```
  apps/cliente/
  apps/console/
  packages/db/
  packages/ui/
  packages/types/
  packages/auth/
  packages/ai/
  packages/integrations/
  packages/config/
  jobs/trigger/        (vacío por ahora)
  docs/
  proyecto/            (mover este folder aquí)
  ```
- ☐ Verificar `turbo.json` y `pnpm-workspace.yaml`.

**Validación:** `pnpm install` corre sin errores; `turbo run dev` arranca todo en paralelo.

**Tiempo:** 1-2 hs.

### Paso 3: Bootstrap apps Next.js

Para `apps/cliente` y `apps/console`:

```bash
pnpm dlx create-next-app@latest apps/cliente --typescript --app --tailwind --eslint --src-dir false
pnpm dlx create-next-app@latest apps/console --typescript --app --tailwind --eslint --src-dir false
```

- ☐ Eliminar contenido boilerplate.
- ☐ Crear layout mínimo en cada una con texto diferenciado: "Cliente" y "Console".
- ☐ Configurar el `tsconfig.json` para extender de `packages/config/tsconfig.base.json`.
- ☐ Configurar Tailwind con `packages/ui/tokens.ts` (o equivalente).
- ☐ Configurar ESLint y Prettier extendiendo de `packages/config`.

**Validación:** `pnpm dev` levanta ambas apps en puertos distintos (cliente:3000, console:3001).

**Tiempo:** 2-3 hs.

### Paso 4: shadcn/ui en `packages/ui`

- ☐ Instalar shadcn en `packages/ui` y copiar componentes base: Button, Input, Label, Form, Card, Table, Toast, Dialog.
- ☐ Configurar `tailwind.config.ts` de cada app para tomar contenido de `packages/ui`.
- ☐ Importar componentes de `packages/ui` desde cada app y validar render correcto.

**Validación:** un Button de shadcn se ve en ambas apps con los mismos estilos.

**Tiempo:** 1-2 hs.

### Paso 5: CI básico (commitear cuando vos decidas)

- ☐ Crear `.github/workflows/ci.yml` con: install, lint, typecheck, build de ambas apps.
- ☐ Decidir cuándo hacer push: cuando estés cómodo con el estado del repo. No hace falta empujar después de cada paso.

📝 **Sugerencia de commit:** `chore(ci): add lint/typecheck/build workflow` cuando hayas confirmado que el workflow está bien armado.

**Validación:** CI verde en el primer push.

**Tiempo:** 1 hs.

---

## 4. Día 2-3 — BD local + Supabase prod + RLS

> **Estrategia de BD por environment:**
> - **Desarrollo local:** PostgreSQL local administrado con pgAdmin 4. Rápido, sin costo, sin red, sin riesgo de tocar prod.
> - **Producción y staging/preview:** Supabase (Postgres gestionado + RLS + Storage + Edge Functions).
> - **Mismas migraciones para ambos**: el ORM aplica el mismo schema en local y en Supabase.

### Paso 6a: Setup BD local (desarrollo)

- ☐ Instalar PostgreSQL 16+ localmente (si no está ya).
- ☐ Instalar pgAdmin 4 como cliente gráfico.
- ☐ Crear BD local: `winlabs_analytics_dev` (y opcionalmente `winlabs_analytics_test` para tests).
- ☐ Crear usuario `wla_dev` con password local + permisos sobre esa BD.
- ☐ Habilitar extensiones necesarias: `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (para UUIDs).

**Validación:** desde pgAdmin 4 te conectás a `winlabs_analytics_dev` y la BD aparece vacía.

**Tiempo:** 30 min.

### Paso 6b: Setup Supabase (producción y staging)

- ☐ Crear proyecto en Supabase (región: la más cercana a LatAm, ej. São Paulo).
- ☐ Anotar `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- ☐ Configurar branching o un segundo proyecto Supabase para "staging/preview" (opcional al principio).

**Validación:** podés acceder al SQL Editor de Supabase y la BD está vacía.

**Tiempo:** 30 min.

### Paso 6c: Variables de entorno

- ☐ Crear `.env.local` para Cliente y Console **apuntando a la BD local** durante desarrollo.
- ☐ Cargar las vars de Supabase como **environment vars en Vercel** (preview y production), no en el `.env.local`.
- ☐ Crear `.env.example` con las claves (sin valores) commiteable en el repo.
- ☐ Asegurarse de que `.env.local` está en `.gitignore`.

**Validación:** `pnpm dev` levanta apps usando BD local; deploy en Vercel preview usa Supabase.

**Tiempo:** 30 min.

### Paso 7: ORM (Drizzle o Prisma) en `packages/db`

Asumiendo Drizzle (cambiar si decidiste Prisma):

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

- ☐ Crear `packages/db/src/schema.ts` con tablas iniciales: `tenants`, `internal_users`, `users`, `roles`, `user_roles`, `audit_log`.
- ☐ Configurar `drizzle.config.ts` apuntando a `DATABASE_URL` (toma el valor del env: local en dev, Supabase en prod).
- ☐ Generar primera migración: `pnpm drizzle-kit generate`.
- ☐ Aplicar migración **a BD local**: `pnpm drizzle-kit migrate`.
- ☐ Aplicar migración **a Supabase** (con `DATABASE_URL` de Supabase en variable de entorno temporal o script de deploy).

**Validación:** las tablas aparecen tanto en pgAdmin (local) como en Supabase Studio (prod).

**Tiempo:** 2-3 hs.

### Paso 8: RLS policies básicas

- ☐ En migración SQL, habilitar RLS en `users`, `roles`, `user_roles`, `audit_log`.
- ☐ Crear policies que filtren por `current_setting('app.current_tenant_id')`.
- ☐ Para `tenants` y `internal_users`: RLS permitida solo a Service Role o función SECURITY DEFINER.

**Validación:** queries con setting de tenant A no devuelven filas de tenant B.

**Tiempo:** 2-3 hs.

### Paso 9: Helper `withTenantContext` en `packages/auth`

- ☐ Implementar `withTenantContext(tenantId, fn)` que abra transacción + `SET LOCAL app.current_tenant_id`.
- ☐ Wrapper de `db` (Drizzle client) que use este helper.
- ☐ Test que valide: dos tenants ven solo sus filas.

**Validación:** test RLS pasa en CI.

**Tiempo:** 2-3 hs.

---

## 5. Día 4-5 — NextAuth + flujos básicos

### Paso 10: NextAuth en ambas apps

- ☐ Instalar NextAuth v5 (Auth.js) en ambas apps.
- ☐ Configurar provider Credentials (email + password con hash).
- ☐ Sesiones JWT con custom claims: `userId`, `tenantId`, `roles`.
- ☐ Para Console: adapter contra tabla `internal_users` (separada).
- ☐ Páginas: `/login`, `/forgot-password`, `/reset-password`.

**Validación:** podés loguearte con un usuario seed en Cliente y otro en Console.

**Tiempo:** 4-6 hs.

### Paso 11: Middleware de tenant en Cliente

- ☐ Middleware Next.js que:
  - Lee la sesión.
  - Si el usuario no tiene tenant, redirige a una página de error.
  - Inyecta el `tenantId` en un AsyncLocalStorage o context para que `withTenantContext` lo tome en server actions.
- ☐ Decisión: si vamos por **subdomain** (`{tenant}.wla.io`), el middleware también valida que el subdomain coincida con el `tenantId` del usuario.

**Validación:** un server action que consulte BD recibe el tenant correcto automáticamente.

**Tiempo:** 2-3 hs.

### Paso 12: Roles y permisos básicos

- ☐ Implementar `assertCanX` helpers en `packages/auth/permissions.ts`.
- ☐ Tests unitarios de permisos.

**Validación:** un user con rol "Viewer" no puede invocar la server action de "editar configuración".

**Tiempo:** 2 hs.

---

## 6. Día 6-7 — Deploy + observabilidad

### Paso 13: Vercel

- ☐ Crear 2 proyectos en Vercel: `wla-cliente` y `wla-console`.
- ☐ Conectar al repo GitHub. Configurar root directory de cada uno (`apps/cliente`, `apps/console`).
- ☐ Configurar env vars en cada environment (development, preview, production).
- ☐ Configurar dominios temporales (`cliente.vercel.app`, `console.vercel.app`) y/o producción si ya tenés DNS.

**Validación:** push a `main` despliega ambos apps a producción.

**Tiempo:** 2-3 hs.

### Paso 14: Sentry

- ☐ Instalar `@sentry/nextjs` en ambas apps.
- ☐ Configurar source maps upload en CI.
- ☐ Lanzar un error de prueba y verificar que llega a Sentry.

**Validación:** error de prueba aparece en Sentry dashboard.

**Tiempo:** 1-2 hs.

### Paso 15: Resend

- ☐ Crear API key Resend.
- ☐ Configurar dominio de envío (validación DNS con SPF/DKIM/DMARC).
- ☐ Enviar email de prueba desde una route handler.

**Validación:** email de prueba llega a tu inbox.

**Tiempo:** 1-2 hs.

### Paso 16: Trigger.dev (o Supabase Edge Functions, según decisión)

Para Trigger.dev:

- ☐ Crear proyecto Trigger.dev y conectar al repo.
- ☐ Setup inicial en `jobs/trigger/`.
- ☐ Definir un job hello-world (cron cada 5 min, loguea timestamp).
- ☐ Deploy.

**Validación:** el job aparece corriendo en el dashboard de Trigger.dev cada 5 min.

**Tiempo:** 2-3 hs.

---

## 7. Día 8-10 — Console mínima + Cliente mínimo

### Paso 17: Console — alta de tenant

- ☐ Página `/tenants` en Console: lista + botón "Nuevo tenant".
- ☐ Server action: crear tenant + usuario inicial admin + activar modelos por default.
- ☐ Validar audit_log entry.

**Validación:** desde Console se crea un tenant con admin, y ese admin puede loguearse en Cliente.

**Tiempo:** 1-2 días.

### Paso 18: Cliente — layout, navegación, dashboard placeholder

- ☐ Layout autenticado con sidebar (Dashboards, Integraciones, Settings).
- ☐ Página `/dashboards` con cards placeholder (sin datos reales todavía).
- ☐ Página `/settings/users` para invitar usuarios al tenant.

**Validación:** un usuario invitado por el admin puede loguearse y ver el layout.

**Tiempo:** 1-2 días.

### Paso 19: Smoke test end-to-end

- ☐ Playwright E2E: signup interno crea tenant → admin se loguea en Cliente → invita user → user se loguea.

**Validación:** test E2E verde en CI.

**Tiempo:** medio día.

---

## 8. Checklist final del setup inicial (cierre semana 2)

Al final de la semana 2 (con margen para imprevistos del solo dev), tener:

- ☐ Monorepo público con apps corriendo en Vercel.
- ☐ Supabase Postgres con schema inicial + RLS activa.
- ☐ NextAuth para Cliente y Console con users reales en BD.
- ☐ CI/CD verde con lint, typecheck, build, RLS test.
- ☐ Sentry capturando errores.
- ☐ Resend enviando emails.
- ☐ Trigger.dev (o equivalente) corriendo al menos un job.
- ☐ Console: alta de tenant funcional.
- ☐ Cliente: login + layout + navegación.
- ☐ Documentación mínima: READMEs de apps y packages, primer ADR ("multi-tenancy via Postgres RLS").

**Hito:** `[M0 cerrado]` — listo para entrar a M1 (Modelo de datos + framework de integraciones).

---

## 9. Variables de entorno (referencia)

A documentar en `.env.example` en cada app:

```
# Supabase
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Resend
RESEND_API_KEY=

# Trigger.dev (si aplica)
TRIGGER_API_KEY=
TRIGGER_PROJECT_REF=

# AI providers
GROQ_API_KEY=
TOGETHER_API_KEY=
ANTHROPIC_API_KEY=  # opcional
OPENAI_API_KEY=     # opcional

# App
APP_BASE_URL=
TENANT_ROUTING_MODE=subdomain  # or 'path'
```

---

## 10. Runbooks iniciales a crear

En `docs/runbooks/`, crear desde el día uno (aunque sean stubs):

- ☐ `onboard-tenant.md` — cómo crear un tenant nuevo desde Console.
- ☐ `run-integration-manually.md` — cómo forzar la ejecución de una integración.
- ☐ `investigate-failed-run.md` — cómo investigar un `integration_run` con status `failed`.
- ☐ `rollback-deploy.md` — cómo hacer rollback de un deploy Vercel.
- ☐ `restore-from-pitr.md` — cómo restaurar Supabase a un punto del pasado.

---

## 11. Riesgos comunes en setup

| Riesgo | Mitigación |
|---|---|
| Configurar RLS mal y darse cuenta tarde | Test RLS desde el día uno + suite automatizada en CI. |
| Mezclar env vars entre environments | Vercel separa por environment; nunca usar `.env.local` para production secrets. |
| Olvidarse `SET LOCAL tenant_id` en alguna query | Wrapper obligatorio de `db` que lo aplique en todas las funciones; lint custom o test que detecte invocaciones directas. |
| Domain DNS mal configurado (subdomain por tenant) | Validar con un tenant de prueba antes de cerrar la decisión. Cloudflare como provider DNS para wildcard. |
| Costos inesperados de servicios | Setear alertas de billing en Vercel y Supabase desde el día uno. |

---

## 12. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-074 | Setup inicial estructurado en checklist secuencial de 10 días | ✅ Cerrada |
| D-075 | Pre-requisitos administrativos (cuentas, dominio) antes de tocar código | ✅ Cerrada |
| D-076 | RLS y tests RLS desde el día uno (no agregar después) | ✅ Cerrada |
| D-077 | NextAuth con tablas `users` y `internal_users` separadas | ✅ Cerrada |
| D-078 | `.env.example` documentado en cada app | ✅ Cerrada |
| D-079 | Runbooks mínimos creados desde M0, aunque sean stubs | ✅ Cerrada |

---

## 13. Decisiones abiertas

- **Subdomain vs path-based** para tenant routing → cerrar antes del Paso 11 (middleware).
- **Prisma vs Drizzle** → cerrar antes del Paso 7.
- **Trigger.dev vs Supabase Edge Functions** → cerrar antes del Paso 16.
- **Provider de Llama** (Groq vs Together vs Fireworks) → cerrar antes de M5.

---

## 14. Próximos pasos

→ Antes del cierre, continúa con `10-estandares-y-skills.md`: convenciones de nombres en BD, diccionario de datos, UX/UI/themes, estilo del menú, template estándar para CRUDs, integración con AI agent tooling y auditoría en detalle.

→ Después, **Cierre (Fase 7)**: crear `README.md` maestro como índice del folder `proyecto/` y `DECISIONS.md` consolidado con todas las decisiones tomadas.
