# DECISIONS.md — Log consolidado de decisiones

> Registro único de todas las decisiones tomadas durante el diseño del proyecto WinLabs Analytics. Cada decisión tiene un ID inmutable (`D-XXX`) y un estado.
>
> Última actualización: 2026-05-19.

---

## Estados posibles

- ✅ **Cerrada** — Decisión tomada, en vigor.
- 🟡 **Tentativa** — Tomada pero sujeta a confirmación al llegar a la fase relevante.
- 🟠 **Abierta** — Pendiente de cerrar.
- 🔄 **Cambiada** — Reemplazada por otra decisión (con link a la nueva).
- ⛔ **Descartada** — Considerada y descartada explícitamente.

---

## Cómo se actualiza este log

- Cada decisión nueva → entrada con número incremental.
- Si una decisión cerrada cambia: NO se reescribe la original. Se marca `🔄 Cambiada` y se referencia la nueva (`Reemplazada por D-XXX`).
- Si una decisión tentativa se confirma o se cambia: se actualiza el estado + se anota la fecha.
- Los detalles completos de cada decisión viven en el documento de fase correspondiente; este log es el resumen navegable.

---

## Fase 1 — Visión y modelo de negocio (`01-vision-y-negocio.md`)

| # | Decisión | Estado |
|---|---|---|
| D-001 | Nombre formal: **WinLabs Analytics** (interno: `wl-Analytics` / `wlA`) | ✅ Cerrada |
| D-002 | Producto **independiente** de Kaivia. Kaivia es conector, no contenedor. | ✅ Cerrada |
| D-003 | MVP construye **motor genérico primero**, luego instancia People Analytics | ✅ Cerrada |
| D-004 | Modelo de negocio: **Setup inicial + SaaS suscripción + Servicios profesionales** | ✅ Cerrada |
| D-005 | ICP dual: anchor accounts mid-market + PyMEs self-serve via web | ✅ Cerrada |
| D-006 | Geografía inicial: **LatAm** | ✅ Cerrada |
| D-007 | Diferenciadores flagship: verticalización + IA insights + integraciones LatAm | ✅ Cerrada |

---

## Fase 2 — Alcance y fases (`02-alcance-y-fases.md`)

| # | Decisión | Estado |
|---|---|---|
| D-008 | Tres fases: MVP (m6) → v1.x Post-MVP (m6–m10) → v2.x (m10+) | ✅ Cerrada |
| D-009 | Dashboards MVP: Cubo/Headcount + Ausentismos + Horas extras + Turnover | ✅ Cerrada |
| D-010 | Integraciones MVP: File-based + Manú + Geovictoria | ✅ Cerrada |
| D-011 | Console MVP: mínima (tenants + modelos + integraciones + usuarios/roles) | ✅ Cerrada |
| D-012 | IA MVP: insights automáticos + insights pre-armados (sin Q&A libre) | ✅ Cerrada |
| D-013 | Self-serve y billing automatizado diferidos a **v2.x** (no MVP, no v1.x) | ✅ Cerrada |
| D-014 | Onboarding MVP y v1.x: asistido (self-serve recién en v2.x) | ✅ Cerrada |
| D-015 | Sin SSO, sin mobile app, sin compliance certificado en MVP | ✅ Cerrada |
| D-016 | v1.x es "expansión con venta asistida": 2–3 clientes más + pulido | ✅ Cerrada |

---

## Fase 3 — Arquitectura (`03-arquitectura.md`)

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

## Fase 3 — Stack tecnológico (`04-stack-tecnologico.md`)

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

## Fase 4 — Modelo de datos (`05-modelo-datos.md`)

| # | Decisión | Estado |
|---|---|---|
| D-039 | Granularidad T&A: daily aggregate + eventos de ausentismo | ✅ Cerrada |
| D-040 | History: snapshot mensual de `hr_people` (SCD2 diferido a v1.x si hace falta) | ✅ Cerrada |
| D-041 | Schema rígido + `custom_fields JSONB` en cada tabla core | ✅ Cerrada |
| D-042 | Modelos MVP: People, Time & Attendance, Payroll (simplificado), Reference tables | ✅ Cerrada |
| D-043 | Triggers integración MVP: Cron + Upload manual + Trigger manual | ✅ Cerrada |
| D-044 | SFTP / Email watched folder: modelado pero no implementado en MVP (v1.x) | ✅ Cerrada |
| D-045 | 4 dashboards con métricas y dimensiones definidas | ✅ Cerrada |
| D-046 | Período histórico inicial: 24 meses | 🟡 Tentativa (confirmar con ancla) |

---

## Fase 4 — Integraciones (`06-integraciones.md`)

| # | Decisión | Estado |
|---|---|---|
| D-047 | Patrón Extract → Transform → Load → Notify para toda integración | ✅ Cerrada |
| D-048 | Idempotencia obligatoria; incremental por default, full refresh forzable | ✅ Cerrada |
| D-049 | Catálogo MVP: File-based (4 templates) + API Manú + API Geovictoria | ✅ Cerrada |
| D-050 | Reglas configurables por tenant: mapping, value mapping, filtros, defaults, validaciones | ✅ Cerrada |
| D-051 | Reconciliación de identidades vía `people_source_ids` + matching manual cuando no hay auto | ✅ Cerrada |
| D-052 | Almacenamiento de credenciales en Supabase Vault (encriptado) | ✅ Cerrada |
| D-053 | Niveles de error: fatal / run-failure / row-error / warning | ✅ Cerrada |
| D-054 | `integration_runs` como tabla canónica de observabilidad de integraciones | ✅ Cerrada |
| D-055 | SFTP/Email watched folder: tablas preparadas, implementación diferida a v1.x | ✅ Cerrada |

---

## Fase 5 — Roadmap (`07-roadmap.md`)

| # | Decisión | Estado |
|---|---|---|
| D-056 | Cadencia: flujo continuo + checkpoints mensuales | ✅ Cerrada |
| D-057 | Fechas relativas (M0…M10+), reanclables si arranque se mueve | ✅ Cerrada |
| D-058 | MVP por área con dependencias críticas explícitas | ✅ Cerrada |
| D-059 | Buffer de ~4 semanas implícito entre cierre funcional y cierre MVP | ✅ Cerrada |
| D-060 | Plan de corte (cuál dashboard / integración cortar primero si hay presión) | ✅ Cerrada |
| D-061 | Gestión: GitHub Issues + Project board, sin herramientas adicionales | ✅ Cerrada |

---

## Fase 6 — Convenciones de código (`08-convenciones.md`)

| # | Decisión | Estado |
|---|---|---|
| D-062 | Código en inglés, UI en español | ✅ Cerrada |
| D-063 | TypeScript strict mode + noUncheckedIndexedAccess + exactOptionalPropertyTypes | ✅ Cerrada |
| D-064 | `any` prohibido salvo en boundaries de librerías sin tipos | ✅ Cerrada |
| D-065 | Validación con Zod en TODOS los boundaries (server actions, route handlers, file parsers) | ✅ Cerrada |
| D-066 | i18n desde día uno con `next-intl` aunque solo soportemos español | ✅ Cerrada |
| D-067 | Branded types para IDs críticos (TenantId, UserId, PersonId) | ✅ Cerrada |
| D-068 | Manejo de errores: tipos custom + helper `handleActionError` + Sentry | ✅ Cerrada |
| D-069 | Conventional Commits sugerido (no enforced) | ✅ Cerrada |
| D-070 | Pre-commit con Husky + lint-staged | ✅ Cerrada |
| D-071 | Security review checklist obligatorio en PRs sensibles | ✅ Cerrada |
| D-072 | ADRs en `docs/adr/` para decisiones arquitectónicas significativas | ✅ Cerrada |
| D-073 | Cobertura crítica >70% en lógica de negocio, E2E happy-path en UI | ✅ Cerrada |

---

## Fase 6 — Setup inicial (`09-setup-inicial.md`)

| # | Decisión | Estado |
|---|---|---|
| D-074 | Setup inicial estructurado en checklist secuencial de ~10 días | ✅ Cerrada |
| D-075 | Pre-requisitos administrativos (cuentas, dominio) antes de tocar código (dominio opcional) | ✅ Cerrada |
| D-076 | RLS y tests RLS desde el día uno (no agregar después) | ✅ Cerrada |
| D-077 | NextAuth con tablas `sec_users` y `wla_internal_users` separadas | ✅ Cerrada |
| D-078 | `.env.example` documentado en cada app | ✅ Cerrada |
| D-079 | Runbooks mínimos creados desde M0, aunque sean stubs | ✅ Cerrada |
| D-079-bis | **BD local para dev (Postgres + pgAdmin 4); Supabase para producción/staging** | ✅ Cerrada |
| D-079-ter | **Dominio NO es prerequisito; usar subdominio de `winlabs.com.ar` o registrar uno nuevo cuando se necesite** | ✅ Cerrada |
| D-079-qtr | **Operaciones Git todas manuales por Winsy; Claude solo sugiere cuándo commitear** | ✅ Cerrada |

---

## Fase 6 — Estándares y skills (`10-estandares-y-skills.md`)

| # | Decisión | Estado |
|---|---|---|
| D-080 | Naming BD: snake_case plural tablas, snake_case columnas, prefijos `is_`/`has_` para booleanos | ✅ Cerrada |
| D-081 | PK `id Int autoincrement` salvo seguridad/logs (UUID); FK `<entidad>_id`; timestamps `created_at`/`updated_at`/`deleted_at` | ✅ Cerrada |
| D-082 | Política proactiva de índices con `tenant_id` como primer campo en compuestos | ✅ Cerrada |
| D-083 | Diccionario de datos vive en `/docs/database/wla_schema.dbml` (DBML + notas); Prisma sincronizado con `///` | ✅ Cerrada |
| D-084 | Sistema de diseño shadcn + Tailwind con tokens en `globals.css` (basado en AI-GEO-platform) | ✅ Cerrada |
| D-085 | Paleta: sidebar oscuro (`#2c3238`), topbar gris (`#363d43`), primary azul WinLabs (hex a confirmar) | ✅ Cerrada |
| D-086 | Tipografía Arial/Helvetica (alineado con AI-GEO); iconografía Lucide React exclusiva | ✅ Cerrada |
| D-087 | Sidebar colapsable + topbar + project switcher + user menu (patrón AI-GEO) | ✅ Cerrada |
| D-088 | Estados visuales estándar: skeletons / Loader scanner / EmptyState / banner / toasts | ✅ Cerrada |
| D-089 | Template CRUD enterprise B2B: PageHeader sin breadcrumbs duplicados, Exportar (XLSX+PDF) obligatorio, Herramientas obligatorio, Crear; DataTable server-side; Dialog para forms | ✅ Cerrada |
| D-090 | CLAUDE.md en raíz + skills propias en `.claude/skills/` (add-table, add-crud, add-integration, add-dashboard, add-ai-tool) | ✅ Cerrada |
| D-091 | Prompts al LLM ensamblados desde plantillas controladas; sin PII detallada al LLM | ✅ Cerrada |
| D-092 | `sec_audit_log` append-only con triggers SQL que impiden UPDATE/DELETE | ✅ Cerrada |
| D-093 | Wrapper `audit()` invocado automáticamente desde Server Actions de CRUD | ✅ Cerrada |
| D-094 | Vista de auditoría en Console (cross-tenant) y en Cliente (sólo del tenant, v1.x+) | ✅ Cerrada |
| **D-095** | **ORM: Prisma (cambia recomendación previa de Drizzle); alineado con AI-GEO-platform y Kaivia. Actualiza `04-stack-tecnologico.md` §3.2** | ✅ Cerrada |
| D-096 | Taxonomía de prefijos: `sec_`, `wla_`, `hr_`, `att_`, `pay_`, `int_`, `dsh_`, `ai_`, `nav_`, `cfg_` | ✅ Cerrada |
| D-097 | SKILL 6 [GENERATE_DOCUMENTATION] con estructura obligatoria; docs en `/docs/modules/` o `/docs/architecture/` | ✅ Cerrada |
| D-098 | SKILL 7 [CMP_DB_MODELING] obligatorio: DBML primero, Prisma después, notas en ambos | ✅ Cerrada |
| D-099 | SKILL 9 [AI_AGENT_TOOLING_INTEGRATION]: cada Server Action expone tool en `packages/ai/tools.ts`; `tenantId`/`userId` NUNCA como parámetro | ✅ Cerrada |
| D-100 | SKILL 10 [PRISMA_SEED_AND_MIGRATE]: seeds modulares idempotentes en `/prisma/seeds/`; PROHIBIDO seedear `nav_menu`/`nav_reports` | ✅ Cerrada |
| D-101 | SKILL 11 [PERFORMANCE_CACHE_STRATEGY]: `unstable_cache` con tags + `revalidateTag` post-mutación + `React.cache` para dedupe por request | ✅ Cerrada |
| D-102 | Criterios de implementación con Claude Code: 6 etapas (objetivo / archivos / implementar / validar / documentar / continuar); anti-patterns explícitos | ✅ Cerrada |
| D-103 | Sidebar default state: **colapsado** (alineado con AI-GEO-platform) | ✅ Cerrada |
| D-104 | Forms de CRUD en `<Dialog>` (modal central); `<Sheet>` no se usa para CRUDs estándar | ✅ Cerrada |
| D-105 | Auditoría también captura invocaciones del agente LLM (actor_type='agent', ai_session_id en context) | ✅ Cerrada |

---

## Decisiones abiertas (snapshot)

Las siguientes decisiones están abiertas o tentativas. Bloquean / condicionan trabajos futuros.

| # | Pregunta | Cuándo cerrar |
|---|---|---|
| Open-1 | **Hex exacto del azul WinLabs** (paleta primary) | Antes de diseñar la primera pantalla |
| Open-2 | **Logo / marca visual** del producto (icono "WL") | Antes de la primera demo externa |
| Open-3 | **Subdomain (`{tenant}.wla.io`) vs path-based (`app/t/{tenant}`)** | Antes del Paso 11 de setup (middleware) |
| Open-4 | **Trigger.dev vs Supabase Edge Functions + pg_cron** (re-eval D-026) | Al iniciar M1 (framework de integraciones) |
| Open-5 | **Llama hosting**: Groq vs Together.ai vs Fireworks | Antes de M5 (capa IA) |
| Open-6 | **APIs Manú y Geovictoria**: docs, sandbox, auth, paginación, rate limits | Idealmente antes de M0; bloquea M4 |
| Open-7 | **Calendario laboral**: modelo propio vs depender de Geovictoria | Al diseñar Time & Attendance en detalle |
| Open-8 | **Costos en métricas**: pre-calculados vs derivados en wlA | Al diseñar Payroll en detalle |
| Open-9 | **Período histórico inicial** del cliente ancla (D-046, default 24 meses) | Al negociar con el cliente ancla |
| Open-10 | **Provider de billing v2.x**: Stripe vs MercadoPago | Al iniciar v2.x |
| Open-11 | **Segundo vertical post-People**: Finance vs CRM vs Ventas | Al cerrar v1.x con feedback de mercado |
| Open-12 | **Política de retención `sec_audit_log`** | Al firmar el primer contrato |
| Open-13 | **DNS provider**: Cloudflare (gratis, recomendado) vs otros | Cuando se compre/use el dominio |
| Open-14 | **Mejora a SCD2** para campos críticos de people (D-040 fallback) | Solo si snapshot mensual queda corto |
| Open-15 | **Programa de partners / implementadores** (v2.x+) | Al cerrar v1.x |
| Open-16 | **T0 efectivo** (fecha real de arranque) | Cuando Winsy decida arrancar |

---

## Changelog del log de decisiones

| Fecha | Cambio |
|---|---|
| 2026-05-19 | Versión inicial. D-001 a D-105 cerradas durante el diseño de Fases 1-7. |
