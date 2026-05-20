# 04 - Stack tecnológico

> Documento de Fase 3 (parte 2). Lista concreta de tecnologías, servicios, librerías y versiones.
> Última actualización: 2026-05-19.
> Decisiones arquitectónicas: ver `03-arquitectura.md`.

---

## 1. Resumen

| Capa | Tecnología elegida |
|---|---|
| **Lenguaje principal** | TypeScript |
| **Frontend + Backend** | Next.js 15+ (App Router, Server Actions, Route Handlers) |
| **UI** | React + Tailwind CSS + shadcn/ui |
| **Visualización** | Recharts (gráficos) + TanStack Table (tablas pesadas) |
| **Base de datos** | PostgreSQL (Supabase) |
| **ORM** | **Prisma** (decisión cerrada en D-095, ver §3.2) |
| **Auth** | NextAuth / Auth.js |
| **Workflows / Jobs** | Trigger.dev v3 (tentativo, ver §5) |
| **IA** | Vercel AI SDK + Llama vía Groq o Together.ai (default), Anthropic + OpenAI opcionales |
| **Hosting** | Vercel (apps) + Supabase (BD) |
| **Repo** | GitHub privado |
| **CI/CD** | GitHub Actions + Vercel autodeploy |
| **Observabilidad** | Sentry (errores) + Vercel Analytics + logs Supabase + Trigger.dev observability |
| **Monorepo tooling** | Turborepo + pnpm workspaces |

---

## 2. Frontend + Backend (Next.js)

### 2.1 Versión y patrón

- **Next.js 15+** (App Router obligatorio, no Pages Router).
- **React 19+**.
- **Patrón:** Server Components por defecto, Client Components solo donde haga falta interactividad. Server Actions para mutaciones simples. Route Handlers para APIs públicas (webhooks, callbacks).

### 2.2 Estilos y UI

- **Tailwind CSS** como sistema de utilidades.
- **shadcn/ui** como base de componentes (no es una librería, son componentes copiables que viven en `packages/ui`).
- **Iconos:** Lucide React.
- **Forms:** react-hook-form + Zod resolver.
- **Toasts:** sonner.

### 2.3 Visualizaciones

- **Recharts** para gráficos de dashboards (barras, líneas, áreas, donut). Compatible con SSR, suficiente para MVP.
- **TanStack Table v8** para tablas con paginación/sorting/filtering (drill-down de dashboards).
- **Visx** o **D3** quedan como opción si necesitamos visualizaciones más exóticas en v1.x+.

### 2.4 Estado client-side

- **TanStack Query (React Query)** para data fetching y cache.
- **Zustand** para estado global pequeño (filtros activos, selección, modales).

---

## 3. Base de datos y acceso

### 3.1 BD

- **PostgreSQL 16+** sobre **Supabase**.
- **Tier inicial:** Free durante desarrollo, **Pro** ($25/mes) al primer cliente productivo (incluye PITR, backups diarios, mejor IO).
- **Extensiones:** `pg_cron` (programación), `pgvector` (futuro, si almacenamos embeddings), `pg_stat_statements` (performance).

### 3.2 ORM — Prisma (decisión cerrada D-095)

**Decisión final**: **Prisma**, alineado con el workflow validado en otros proyectos de Winsy (AI-GEO-platform, Kaivia-HR, MetaXT/XTime) y con `SKILL 7 [CMP_DB_MODELING]` del documento `10-estandares-y-skills.md`.

Trade-off conocido (para referencia histórica):

| | Prisma (elegido) | Drizzle (descartado) |
|---|---|---|
| DX general | Excelente para CRUD + IntelliSense con `/// docs` | Más cercano a SQL |
| Performance | Bueno (mejorado en 2024-25) | Excelente |
| Edge runtime | Soportado (Prisma 5.10+) | Mejor soporte nativo |
| Esquema | `.prisma` con frontmatter + comentarios `///` | TypeScript puro |
| Migraciones | `prisma migrate dev`, muy maduro | drizzle-kit |
| RLS support | Vía middleware + `SET LOCAL app.current_tenant_id` antes de cada query | Inyección directa más limpia |
| Adopción comunidad | Muy alta | Creciente |
| **Match con workflow del equipo** | ✅ alto (todos los proyectos previos usan Prisma) | ✗ requiere nueva curva |
| **Match con SKILL 7 [CMP_DB_MODELING]** | ✅ skill diseñada sobre Prisma + DBML | ✗ requeriría reescribir el skill |

**Razones que pesaron**:
- Continuidad con AI-GEO-platform / Kaivia / MetaXT (sin curva de aprendizaje).
- SKILL 7 ya validada y reproducible.
- Seed pattern (SKILL 10) ya validado en Prisma.
- El "edge runtime advantage" de Drizzle no es decisivo para wlA (la mayoría de queries van en Node runtime con `SET LOCAL` para RLS).

**Implicancias operativas**:
- Diccionario de datos: `/docs/database/wla_schema.dbml` (DBML).
- Schema: `/prisma/schema.prisma` con comentarios `///`.
- Migraciones: `/prisma/migrations/<timestamp>_<descripcion>/`.
- RLS: helper `withTenantContext(tenantId, fn)` ejecuta `SET LOCAL app.current_tenant_id = ...` en transacción antes de cualquier query.

### 3.3 Migraciones

- `drizzle-kit` o `prisma migrate` según decisión final.
- Ejecutadas en pipeline CI/CD antes del deploy.
- Convención de naming: `YYYYMMDDHHMM_descripcion_corta.sql`.

---

## 4. Autenticación

### 4.1 Librería

- **NextAuth.js v5 (Auth.js)** — la versión nueva con soporte App Router completo.

### 4.2 Proveedores en MVP

- Credenciales (email + password con hash bcrypt o argon2).
- Email magic link (opcional, si el costo de mail provider es razonable — Resend gratis hasta 3k emails/mes).
- **Sin OAuth público** (Google/Microsoft) en MVP — entran en v1.x si los pide el mercado.

### 4.3 Sesiones

- **JWT** strategy (default NextAuth). Stateless.
- Duración: 7 días + refresh.
- Stored claims: `userId`, `tenantId`, `roles` (slim).

### 4.4 Integración con RLS

Helper en `packages/auth`:

```ts
// Pseudocódigo conceptual
async function withTenantContext(session, fn) {
  await db.execute(sql`SET LOCAL app.current_tenant_id = ${session.tenantId}`);
  return fn();
}
```

Se invoca en cada server action / route handler que toca BD.

### 4.5 Recuperación de password

- Flow estándar: solicitar email → token único corto → reset.
- Email vía Resend (free tier 3k/mes; sino transactional service).

---

## 5. Workflows y jobs

### 5.1 Tentativa MVP

- **Trigger.dev v3** como orquestador inicial.
- Free tier: $10/mes de crédito (suficiente para volumen MVP).
- Jobs definidos en TypeScript dentro de `jobs/trigger/`.

### 5.2 Re-evaluación al iniciar Fase 4

Comparar contra **Supabase Edge Functions + pg_cron**:

| | Trigger.dev v3 | Supabase Edge + pg_cron |
|---|---|---|
| Costo | $10/mes crédito free, después usage | Incluido en Supabase Pro |
| Observabilidad | Dashboard rico, retries, logs | Logs básicos |
| Long-running jobs | Sí, multi-step | Limitado a edge function timeout |
| Idempotencia | Built-in | Manual |
| Mejor si... | Workflows complejos con varios steps, retries, throttling | Workflows cortos, atómicos, mucho volumen pequeño |

### 5.3 Cron y scheduling

- Trigger.dev maneja cron directamente.
- Si vamos por Edge Functions, `pg_cron` para schedule + Edge Function como ejecutor.

### 5.4 Notificaciones de fallos

- Webhook hacia un canal Slack/Discord interno de WinLabs.
- Registro en tabla `integration_runs` con detalle.
- Email al admin del tenant si la integración crítica falla (configurable).

---

## 6. IA / LLMs

### 6.1 Abstracción

- **Vercel AI SDK** (`ai` package npm).
- Wrapper propio en `packages/ai` que:
  - Resuelve el provider del tenant (configurado en Console).
  - Aplica límites/quotas.
  - Registra costos y métricas.
  - Maneja fallback si el provider primario falla.

### 6.2 Providers MVP

- **Llama 3.x** vía **Groq** (default por velocidad y costo) o **Together.ai** (más opciones de modelo).
  - A definir antes de empezar Fase 4: pricing concreto y latencia comparativa entre los dos.
- **Anthropic (Claude)** opcional, configurable.
- **OpenAI (GPT)** opcional, configurable.

### 6.3 Casos de uso MVP

- Explicación de métricas en página de detalle de dashboard.
- Insights automáticos (detección de tendencias/anomalías) sobre resúmenes pre-computados.
- Insights pre-armados estáticos en BD como complemento/fallback.

### 6.4 Sin Q&A libre en MVP

- El usuario no escribe prompts libres sobre los datos. La IA opera sobre prompts pre-armados con datos resumidos del backend. Reduce riesgo de alucinación y de exfiltración accidental de datos del tenant.
- Q&A libre se evalúa en v2.x con semantic layer y guardrails.

---

## 7. Observabilidad

| Aspecto | Herramienta |
|---|---|
| Errores de aplicación | **Sentry** (free tier 5k errors/mes) |
| Métricas de performance (Cliente/Console) | **Vercel Analytics** + **Speed Insights** |
| Logs de BD y queries lentas | **Supabase Dashboard** + `pg_stat_statements` |
| Logs de integraciones | **Trigger.dev dashboard** o tabla `integration_runs` |
| Uptime de servicios | **BetterStack** o **Uptime Robot** (free tier) |
| Alertas críticas | Slack webhook desde Sentry + Trigger.dev |

---

## 8. Repo, CI/CD y deploy

### 8.1 Repo

- **GitHub privado**, monorepo con `pnpm` + `turborepo`.
- **Branching:** trunk-based. `main` siempre deployable. Feature branches cortas (1-3 días) con PR review.
- **Commits:** Conventional Commits opcional.

### 8.2 CI (GitHub Actions)

Pipelines en cada PR:

```
- Install (pnpm install, cached)
- Lint (ESLint + Prettier)
- Type-check (tsc --noEmit)
- Test (Vitest)
- Build (turbo build, validar que cada app buildea)
```

### 8.3 CD (Vercel)

- **Preview deployments:** cada PR genera URL `pr-{number}.cliente.vercel.app` y `pr-{number}.console.vercel.app`.
- **Producción:** merge a `main` → autodeploy a Vercel prod.
- **Migraciones de BD:** ejecutadas en pipeline GitHub Actions ANTES del deploy de Vercel (script `migrate:prod`).

### 8.4 Secrets

- Vercel env vars, separadas por environment (development / preview / production).
- Supabase Vault para secrets de BD-side (encriptación de tokens de integraciones por tenant).
- Nunca en repo.

### 8.5 Dominios

- `console.winlabs-analytics.com` (Console).
- `app.winlabs-analytics.com` o `cliente.winlabs-analytics.com` (Cliente).
- Estrategia subdomain por tenant (`{tenant}.winlabs-analytics.com`) vs path-based (`app.../t/{tenant}`) → **decisión abierta** (impacta middleware Next.js y manejo de DNS).
- Provider DNS: a definir (Cloudflare gratis recomendado).

---

## 9. Testing

| Tipo | Herramienta |
|---|---|
| Unit | Vitest |
| Integration (con BD) | Vitest + testcontainers (Postgres en Docker) o Supabase local |
| E2E | Playwright |
| RLS regression | Suite custom que verifica que tenant A no puede leer tenant B |

**Cobertura objetivo MVP:** lógica de negocio crítica (parsers de integración, transformaciones, cálculo de métricas, RLS) >70%. UI con E2E happy-path en flujos clave (login, ver dashboard, configurar integración).

---

## 10. Mensajería / Emails

- **Resend** (transactional emails). Free tier 3k emails/mes.
- Casos MVP: confirmación de cuenta, reset password, alertas de fallo de integración, invitación de usuarios.
- Plantillas en React Email.

---

## 11. Pricing aproximado de servicios (orden de magnitud)

| Servicio | Plan MVP | Costo mensual estimado |
|---|---|---|
| Vercel (Cliente + Console) | Pro (necesario por equipos / domains) | ~$20 (1 user) |
| Supabase | Pro | $25 |
| Trigger.dev | Free → Hobby | $0 → $20 |
| Sentry | Developer (free) | $0 |
| Resend | Free → Pro | $0 → $20 |
| Groq / Together.ai | Pay-as-you-go | variable, estimado $10-50 |
| GitHub | Free (privado, 1 dev) | $0 |
| Dominio + Cloudflare | Anual | ~$15/año |
| **Total mensual aprox MVP** | | **$55 – $135** |

Sale barato porque sos uno solo y Vercel/Supabase tienen tiers generosos. Escala a más cuando crezca el volumen.

---

## 12. Librerías aprobadas (catálogo inicial)

| Categoría | Librería |
|---|---|
| Validación | Zod |
| Forms | react-hook-form |
| Tablas | TanStack Table |
| Charts | Recharts |
| Estado server | TanStack Query |
| Estado client | Zustand |
| UI | shadcn/ui + Tailwind |
| Iconos | Lucide |
| Notifications | sonner |
| Email rendering | React Email |
| HTTP | fetch nativo + ofetch (helper) |
| Date/time | date-fns |
| File parsing | xlsx (SheetJS), papaparse (CSV) |
| Testing | Vitest + Playwright |
| Linting | ESLint + Prettier |
| AI SDK | Vercel AI SDK |

## 13. Librerías prohibidas (lista inicial)

- **Moment.js** — usar date-fns (más liviano, immutable).
- **Lodash** completo — preferir funciones nativas o `lodash-es` tree-shaken si imprescindible.
- **jQuery** — innecesario en React.
- **Cualquier ORM con SQL string concat** — uso de Prisma/Drizzle obligatorio.

---

## 14. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-029 | Lenguaje: TypeScript en todo el monorepo | ✅ Cerrada |
| D-030 | Framework: Next.js 15+ App Router con Server Actions | ✅ Cerrada |
| D-031 | UI: Tailwind + shadcn/ui + Recharts + TanStack Table | ✅ Cerrada |
| D-032 | DB: Postgres en Supabase, tier Pro al pasar a productivo | ✅ Cerrada |
| D-033 | Email transactional: Resend | ✅ Cerrada |
| D-034 | Observabilidad: Sentry + Vercel Analytics | ✅ Cerrada |
| D-035 | Testing: Vitest + Playwright + suite custom RLS | ✅ Cerrada |
| D-036 | Repo: GitHub privado, monorepo con pnpm + Turborepo | ✅ Cerrada |
| D-037 | CI/CD: GitHub Actions + Vercel autodeploy | ✅ Cerrada |
| D-038 | Librerías aprobadas/prohibidas formalizadas | ✅ Cerrada |

---

## 15. Decisiones abiertas

- ~~**ORM**: Prisma vs Drizzle — se cierra al inicio de Fase 6.~~ → **Cerrado en D-095: Prisma**.
- **Subdomain vs path-based** para tenants — se cierra antes de programar el middleware de auth.
- **Llama hosting**: Groq vs Together.ai — comparar pricing y latencia antes de Fase 4.
- **Trigger.dev vs Supabase Edge Functions** — re-evaluar al iniciar Fase 4.
- **DNS provider**: Cloudflare (gratis, recomendado) vs otros.
- **Mobile**: ¿responsive nativo o app dedicada? Se ve en v2.x según demanda.

---

## 16. Próximos pasos

→ Pasamos a **Fase 4: Modelo de datos e integraciones** — `05-modelo-datos.md` y `06-integraciones.md`.

Diseñaremos:
- El esquema canónico de los modelos del MVP (People, Time, Payroll).
- Métricas y dimensiones concretas de cada uno de los 4 dashboards.
- Detalle de los workflows de integración (file-based + Manú + Geovictoria).
