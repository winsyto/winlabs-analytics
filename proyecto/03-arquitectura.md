# 03 - Arquitectura

> Documento de Fase 3 (parte 1). Define la arquitectura macro: multi-tenancy, separación Cliente/Console, capas, workflows de integración, seguridad.
> Última actualización: 2026-05-19.
> Stack tecnológico concreto: ver `04-stack-tecnologico.md`.

---

## 1. Resumen ejecutivo

WinLabs Analytics es una plataforma SaaS multi-tenant **shared-DB con Row-Level Security (RLS)**, compuesta por dos aplicaciones Next.js full-stack (Cliente y Console) que viven en un **monorepo**, comparten una BD Postgres en Supabase, y delegan los workflows de integración pesados a un orquestador externo (Trigger.dev como hipótesis inicial).

```
┌─────────────────────────────────────────────────────────────────┐
│                        WinLabs Analytics                         │
│                                                                  │
│  ┌──────────────────┐                  ┌─────────────────────┐  │
│  │   App Cliente    │                  │    App Console      │  │
│  │   (Next.js)      │                  │    (Next.js)        │  │
│  │  cliente.wla.io  │                  │  console.wla.io     │  │
│  │   - Dashboards   │                  │  - Gestión tenants  │  │
│  │   - Integraciones│                  │  - Modelos          │  │
│  │   - Settings     │                  │  - Integraciones    │  │
│  └────────┬─────────┘                  └──────────┬──────────┘  │
│           │                                       │             │
│           │     ┌───────────────────────┐         │             │
│           └────►│   packages/* shared    │◄────────┘             │
│                 │  - db (Prisma/Drizzle)│                       │
│                 │  - ui (shadcn/Tailwind)│                       │
│                 │  - types              │                       │
│                 │  - auth (NextAuth)    │                       │
│                 │  - ai (LLM provider)  │                       │
│                 └───────────┬───────────┘                       │
│                             │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐ │
│  │              Supabase (Postgres + RLS)                    │ │
│  │   1 BD shared multi-tenant, todos los modelos             │ │
│  │   - tenants, users, roles                                  │ │
│  │   - people, time_attendance, payroll, ... (por tenant)    │ │
│  │   - integration_runs, dashboards_config                    │ │
│  └────────────────────────────▲──────────────────────────────┘ │
│                                │                                │
│  ┌─────────────────────────────┴────────────────────────────┐ │
│  │   Trigger.dev (workflows de integración)                  │ │
│  │   - ETL jobs (file-based, Manú, Geovictoria)             │ │
│  │   - Cron / scheduling                                     │ │
│  │   - Retries / observability                               │ │
│  └────────────────────┬─────────────────────────────────────┘ │
│                       │                                         │
│  ┌────────────────────▼─────────────────────────────────────┐ │
│  │   LLM Provider abstraction (Vercel AI SDK)                │ │
│  │   Default: Llama (via Groq / Together.ai)                 │ │
│  │   Alternativas: Anthropic, OpenAI (configurable / tenant) │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-tenancy

### 2.1 Decisión

**Modelo:** 1 BD Postgres shared multi-tenant + Row-Level Security (RLS) sobre Supabase. Todos los modelos viven en la misma BD; cada fila relevante lleva `tenant_id` y RLS garantiza que cada tenant solo vea sus filas.

### 2.2 Por qué no las otras opciones

| Opción | Por qué no para MVP |
|---|---|
| 1 BD por tenant (Kaivia-style) | Operación 10x para un solo dev: backups por tenant, migraciones por tenant, monitoring por tenant. Justificable solo si hay clientes Enterprise con compliance estricto. |
| Múltiples BD multi-tenant (1 por modelo) | Joins cross-modelo difíciles; complejidad operativa similar a BD por tenant. Solo se justifica si los modelos son radicalmente distintos. |
| Híbrido (shared para PyME + dedicada para Enterprise) | Atractivo a largo plazo pero exige dos pipelines operativos en paralelo. **Diferido a v2.x** si lo demanda un cliente concreto. |

### 2.3 Implementación RLS en Postgres

- Cada tabla con datos del tenant tiene columna `tenant_id uuid NOT NULL`.
- Política RLS típica: `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`.
- La aplicación setea `app.current_tenant_id` al inicio de cada conexión/transacción, basándose en la sesión NextAuth (ver sección 5).
- Usuarios internos WinLabs (Console) tienen un rol especial que **bypasa RLS** para ciertas operaciones administrativas, auditadas explícitamente.
- Tests automáticos de RLS: cada PR ejecuta queries de tenant A intentando leer de tenant B y verifica que devuelvan vacío.

### 2.4 Plan de migración a dedicada (futuro)

Si un cliente Enterprise exige BD dedicada (v2.x+):

1. Provisionar nueva BD en Supabase (proyecto dedicado).
2. Migrar el subset de filas del tenant (export/import o `pg_dump --table` con filtro).
3. Actualizar Console para enrutar queries de ese tenant a la nueva BD (connection switch por `tenant_id`).
4. Mantener el modelo shared como default; dedicada como upgrade Enterprise tier.

Diseño defensivo: la capa de acceso a BD debe estar abstraída desde el día uno para que cambiar el connection target por tenant no requiera tocar lógica de negocio.

---

## 3. Estructura de proyectos (monorepo)

### 3.1 Decisión

**Monorepo único** con Turborepo. Apps independientes para Cliente y Console; packages compartidos.

### 3.2 Layout propuesto

```
winlabs-analytics/
├── apps/
│   ├── cliente/              # Next.js app del cliente final
│   │   ├── app/             # App Router
│   │   ├── components/      # Componentes específicos
│   │   └── package.json
│   └── console/              # Next.js app interna WinLabs
│       ├── app/
│       ├── components/
│       └── package.json
├── packages/
│   ├── db/                   # Schema, Prisma client, migraciones, queries
│   ├── ui/                   # Design system (shadcn + Tailwind)
│   ├── types/                # Tipos TS compartidos
│   ├── auth/                 # NextAuth config + helpers RLS
│   ├── ai/                   # LLM provider abstraction
│   ├── integrations/         # Lógica core de workflows ETL
│   └── config/               # ESLint, Tailwind, tsconfig compartidos
├── jobs/
│   └── trigger/              # Trigger.dev workflows (o equivalente)
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

### 3.3 Por qué esto resuelve "visiones distintas"

- Cliente y Console son **apps separadas**: rutas, layouts, navegación, estilos visuales, deploys, dominios totalmente independientes.
- Solo comparten lo que conviene compartir: **modelo de datos, design tokens, tipos, helpers**.
- No hay "feature flag" mezclando UIs: cada app tiene su rol claro.

---

## 4. Separación Cliente vs Console (límites)

| Aspecto | Cliente | Console |
|---|---|---|
| **Audiencia** | Usuario final del tenant | Equipo WinLabs (admin) |
| **Dominio sugerido** | `cliente.winlabs-analytics.com` o `{tenant}.winlabs-analytics.com` | `console.winlabs-analytics.com` |
| **Auth** | NextAuth con BD principal | NextAuth con tabla `internal_users` (separada de `users`) |
| **Acceso a tenants** | Restringido al tenant del usuario (RLS) | Cross-tenant (bypass RLS controlado) |
| **Capacidades** | Ver dashboards, gestionar usuarios del tenant, configurar integraciones disponibles | Crear/suspender tenants, activar modelos e integraciones, gestionar partners/contratos (v1.x+) |
| **Permisos** | Roles configurables por tenant | Roles fijos: admin, ops, soporte |

### 4.1 Capa de servicio compartida

La lógica de negocio común (queries de dashboards, ejecución de integraciones, validaciones de modelos) vive en `packages/` y se consume desde ambas apps. La diferencia es la UI y los permisos de invocación.

---

## 5. Autenticación, autorización y seguridad

### 5.1 Auth

- **Provider:** NextAuth / Auth.js.
- **Estrategias en MVP:** email + password, magic link (opcional). Sin SSO.
- **Almacenamiento:** tablas `users` (para tenants) e `internal_users` (para Console) en Postgres.
- **Sesiones:** JWT firmadas (default NextAuth), expiración corta + refresh.

### 5.2 Integración NextAuth ⇄ RLS

Punto crítico: NextAuth no setea automáticamente el `tenant_id` de Postgres. Se resuelve con un **middleware/helper de DB**:

1. Al inicio de cada request, leer la sesión NextAuth y extraer `userId` + `tenantId`.
2. Antes de cualquier query, ejecutar `SET LOCAL app.current_tenant_id = '<tenant_uuid>'` en la transacción.
3. Las policies RLS de cada tabla filtran por ese setting.

> Si esto se vuelve fricción, alternativa: migrar a Supabase Auth en v1.x (es mejor amigo de RLS) o usar PostgREST con JWT custom claims. Por ahora, NextAuth + helper RLS es manejable.

### 5.3 Roles y permisos

- **Por tenant** (en Cliente): roles configurables (Admin Tenant, Manager, Viewer, etc.) con permisos sobre dashboards, modelos, integraciones, usuarios.
- **Internos WinLabs** (en Console): roles fijos (Super Admin, Ops, Soporte).
- Modelo: tabla `roles` con permisos JSON; tabla `user_roles` que vincula `user_id ↔ role_id` (con `tenant_id` para roles de tenant).

### 5.4 Auditoría

- Tabla `audit_log` registra acciones sensibles: cambios de configuración, activación/desactivación de integraciones, runs manuales, accesos cross-tenant desde Console.
- Campos: `actor_id`, `actor_type` (user/internal), `tenant_id`, `action`, `target`, `payload_diff`, `timestamp`, `ip`.
- Inmutable: append-only.

### 5.5 Seguridad obligatoria (checklist)

Heredamos de `idea.md` y formalizamos:

- ✅ Queries SQL parametrizadas (ORM Prisma/Drizzle, nunca string concat).
- ✅ Validación de input con Zod en todos los endpoints/server actions.
- ✅ RLS activa en TODAS las tablas con datos de tenant.
- ✅ Secrets fuera del repo (Vercel env vars + Supabase vault).
- ✅ HTML rendering pasa por React (escapa por defecto). Si hay HTML "raw", se sanitiza con DOMPurify.
- ✅ Auth checks explícitos en todos los server actions y route handlers.
- ✅ Rate limiting en endpoints públicos (signup, login) — vía Vercel o `@upstash/ratelimit`.
- ✅ CSRF: Next.js server actions tienen protección built-in; route handlers manuales agregan tokens.
- ✅ Logs no contienen PII innecesaria (no loguear payloads completos en producción).

### 5.6 Backup y recovery

- Supabase point-in-time recovery (PITR) en tier Pro.
- Backups diarios automáticos.
- Plan de recuperación: documentado en `09-setup-inicial.md` (Fase 6).

---

## 6. Workflows de integración

### 6.1 Modelo conceptual

Cada integración es un **workflow** con tres etapas estándar (parametrizables por cliente):

1. **Recolección (Extract):** lee la fuente (archivo, API).
2. **Limpieza (Transform):** aplica reglas (filtros, mapeos, normalización).
3. **Update (Load):** persiste en el modelo de datos del tenant.

Cada etapa tiene **reglas** configurables por cliente (ej: "descartar empleados con tipo de contrato X", "mapear código de área de Manú a estructura de wlA").

### 6.2 Orquestador

**Decisión MVP:** **Trigger.dev v3** (sujeto a re-evaluación al iniciar Fase 4).

Razones:
- Free tier suficiente para MVP ($10/mes crédito).
- DX excelente con Next.js (define jobs como funciones TS, no YAML).
- Reintentos, scheduling cron, idempotencia, observabilidad built-in.
- Logs ricos para debugging de workflows.

**Alternativa a re-evaluar:** Supabase Edge Functions + `pg_cron`.
- Si los workflows MVP terminan siendo simples (1 cron diario que corre <30s), Edge Functions + pg_cron es más barato y mantiene todo en Supabase.
- Si los workflows son complejos (multi-step, reintentos, throttling), Trigger.dev gana.

**Trigger:** evaluamos al inicio de Fase 4 con los workflows concretos en mano.

### 6.3 Patrón de ejecución

```
[Cron / trigger manual / webhook]
       │
       ▼
[Trigger.dev job: "run-integration-{tenant}-{integration}"]
       │
       ├── Step 1: Extract (lee XLS / llama Manú API / Geovictoria API)
       │   ├── retries automáticos
       │   └── timeout adecuado al volumen
       │
       ├── Step 2: Transform (aplica reglas configuradas en Console)
       │   └── normaliza al esquema canónico de wlA
       │
       ├── Step 3: Load (upsert en BD Postgres con tenant_id)
       │   └── transacción con RLS aplicada
       │
       └── Step 4: Notify (registra en integration_runs, dispara emails si falla)
```

### 6.4 Modelos de integración disponibles (MVP)

- **File-based**: XLS / CSV / JSON. Workflow estándar: lee desde directorio/upload, valida estructura, transforma, carga.
- **API Manú**: workflow custom con auth Manú + paginación + manejo de cambios incrementales.
- **API Geovictoria**: workflow custom similar a Manú.

Cada modelo es un "template" parametrizable. Console permite:
- Activar/desactivar por tenant.
- Configurar reglas de cada etapa (filtros, mapeos, transformaciones).
- Programar cron por tenant.
- Ver run history y detalles de ejecución.

### 6.5 Modelo de datos para integraciones

```
integration_templates  (catálogo)
  ├─ id, name, type, schema_config (JSON)

tenant_integrations  (instancia por tenant)
  ├─ id, tenant_id, template_id, status, config (JSON), cron_schedule

integration_runs  (historial de ejecuciones)
  ├─ id, tenant_integration_id, started_at, finished_at, status,
  │  rows_processed, errors (JSON), trigger_job_id
```

---

## 7. Capa de IA

### 7.1 Abstracción multi-provider

**Decisión:** wlA usa una **abstracción de LLM provider** desde el día uno, con configurabilidad por tenant desde Console.

```
Console:
  por tenant → seleccionar LLM provider + modelo
              → setear API key (si externo) o usar default WinLabs

App Cliente (al generar insight):
  → packages/ai → resuelve provider configurado para el tenant
  → ejecuta inferencia
  → registra costo + métricas
```

### 7.2 Provider default

**Llama** (vía servicio hosteado: Groq, Together.ai o Fireworks). Razones:
- Costo significativamente menor que Claude/GPT-4 a volumen.
- Latencia muy buena en Groq.
- Ya hay experiencia previa con multi-LLM configurable (Kaivia).

### 7.3 Providers soportados (catálogo MVP)

| Provider | Modelos | Uso recomendado |
|---|---|---|
| Llama vía Groq/Together (default) | Llama 3.x 70B / 405B | Insights, explicaciones de métricas |
| Anthropic (opcional) | Claude Sonnet/Haiku | Análisis más profundo, casos premium |
| OpenAI (opcional) | GPT-4o / GPT-5 | Alternativa premium |

### 7.4 Librería propuesta

**Vercel AI SDK** (`ai` package) — abstracción oficial con adaptadores para todos los providers mencionados. Permite cambiar provider sin reescribir lógica de inferencia.

### 7.5 Patrón de uso (MVP)

- **Insights automáticos sobre métricas**: cada dashboard tiene una página de detalle. Al abrir, se llama al LLM con la métrica + contexto del tenant + datos resumidos → devuelve explicación + recomendaciones.
- **Insights pre-armados**: textos escritos a mano, almacenados en BD, asociados a métricas específicas. No requieren LLM. Útiles para casos típicos y como fallback si la API falla.
- **Tracking de costos**: tabla `ai_usage` registra prompts/tokens/costo por tenant para análisis y posible chargeback.

---

## 8. CI/CD y deploy

> Detalle en `04-stack-tecnologico.md` y `09-setup-inicial.md` (Fase 6).

- **Repo:** GitHub (privado).
- **CI:** GitHub Actions (lint, type-check, test).
- **CD:** Vercel autodeploy (preview por PR, prod desde `main`).
- **DB migraciones:** Prisma migrate, ejecutadas en pipeline antes del deploy.
- **Secrets:** Vercel env vars (separados por environment).
- **Branching:** trunk-based con feature branches cortas.

---

## 9. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-017 | Multi-tenancy: 1 BD shared Postgres + RLS sobre Supabase | ✅ Cerrada |
| D-018 | Estructura: monorepo con Turborepo (apps + packages) | ✅ Cerrada |
| D-019 | Dos apps separadas: Cliente y Console, dominios independientes | ✅ Cerrada |
| D-020 | Next.js full-stack (server actions + route handlers) | ✅ Cerrada |
| D-021 | Auth: NextAuth / Auth.js | ✅ Cerrada |
| D-022 | RLS integrada via helper que setea `app.current_tenant_id` por request | ✅ Cerrada |
| D-023 | Auditoría obligatoria de acciones sensibles (append-only) | ✅ Cerrada |
| D-024 | Validación de input con Zod, ORM con queries parametrizadas | ✅ Cerrada |
| D-025 | IA: abstracción multi-provider (Vercel AI SDK), default Llama vía Groq/Together | ✅ Cerrada |
| D-026 | Workflow orchestrator inicial: Trigger.dev (re-evaluación al iniciar Fase 4) | 🟡 Tentativa |
| D-027 | Hosting: Vercel (Cliente + Console). Supabase para Postgres | ✅ Cerrada |
| D-028 | BD dedicada por tenant queda diferida a v2.x+ (si lo exige Enterprise) | ✅ Cerrada |

---

## 10. Decisiones abiertas

- **Confirmación de Trigger.dev vs Supabase Edge Functions** al iniciar Fase 4 (Integraciones).
- **Servicio de Llama hosting**: Groq vs Together.ai vs Fireworks (pricing y latencia comparados antes de cerrar).
- **Estrategia de subdominios para tenants**: `cliente.wla.io` único (tenant en path/header) vs `{tenant}.wla.io` (subdominio). Impacta cómo se hace el routing en Next.js middleware.
- **Plan de upgrade a BD dedicada** (cuándo y cómo) — define al primer cliente que lo demande.

---

## 11. Próximos pasos

→ Continúa con `04-stack-tecnologico.md`: la lista concreta de tecnologías, servicios, librerías y versiones (Next.js, Postgres, Prisma, NextAuth, shadcn, Tailwind, Vercel AI SDK, Trigger.dev, Sentry, etc.).
