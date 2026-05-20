# 07 - Roadmap general

> Documento de Fase 5. Sintetiza Fases 1-4 en un plan de ejecución hasta MVP, v1.x y v2.x. Estructura: vista Now/Next/Later + detalle MVP por área.
> Última actualización: 2026-05-19.

---

## 1. Resumen ejecutivo

Roadmap en tres horizontes:

| Horizonte | Ventana | Objetivo |
|---|---|---|
| **Now (MVP)** | M0 → M6 | Cliente ancla en producción + 3 demos vendibles |
| **Next (v1.x Post-MVP)** | M6 → M10 | 2-3 clientes pagantes adicionales (venta asistida) + polish |
| **Later (v2.x)** | M10+ | Self-serve, billing automático, nuevos verticales |

> **M0 = mes de arranque del desarrollo**. Fechas relativas porque no hay deadline duro y la fecha de arranque puede mover.

---

## 2. Cómo trabajamos

**Cadencia:** flujo continuo (no sprints rígidos). Sí hay **checkpoints mensuales** para revisar progreso y reajustar.

**Disciplina mínima:**

- Cada cierre de mes (M0→M1, M1→M2, etc.) → checkpoint: ¿qué se entregó?, ¿qué quedó pendiente?, ¿hay que mover algo?
- `TASKS.md` (o equivalente) como única fuente de verdad de trabajo activo.
- `DECISIONS.md` se actualiza cada vez que se cierra una decisión abierta o cambia una cerrada.
- Cualquier desvío del roadmap > 2 semanas → reflejarlo acá explícitamente.

**Herramientas de gestión:** simple. GitHub Issues + Project board para tracking, este `07-roadmap.md` como vista macro. Sin Jira ni nada elaborado.

---

## 3. Vista Now / Next / Later (alto nivel)

### NOW — MVP (M0 → M6)

**Foco:** entregar al cliente ancla en producción + 3 demos vendibles.

| Área | Entregable principal |
|---|---|
| Spine | Monorepo + Next.js + Postgres+RLS + NextAuth + Trigger.dev + deploy CI/CD |
| Cliente | 4 dashboards (Cubo, Ausentismos, HHEE, Turnover) + settings + integraciones UI |
| Console | Tenants + modelos + integraciones (mínima) + usuarios internos |
| Integraciones | File-based (4 templates) + Manú API + Geovictoria API + reconciliación |
| IA | Provider abstraction + Llama default + insights automáticos + insights pre-armados |

### NEXT — v1.x Post-MVP (M6 → M10)

**Foco:** vender a 2-3 clientes más con onboarding asistido, mejorar lo que se aprendió.

| Área | Entregable principal |
|---|---|
| Producto | Polish UX, plantillas de dashboards aplicables out-of-the-box |
| Integraciones | Conectores API adicionales según pipeline (Kaivia, RHPro, otros) + SFTP/Email watched folder |
| IA | Mejoras en insights basadas en feedback ancla, posible Q&A acotado |
| Operación | Cobranza manual de suscripciones, dashboards de salud para Console |
| Datos | Evaluación de SCD2 para campos críticos si snapshot mensual queda corto |

### LATER — v2.x (M10+)

**Foco:** producto self-serve + expansión multi-vertical.

| Área | Entregable principal |
|---|---|
| Self-serve | Signup público, wizard onboarding, tier Starter activable web |
| Billing | Integración con Stripe / MercadoPago, suscripciones automáticas |
| Verticales | Segundo paquete (Finance / CRM / Ventas — a definir según mercado) |
| IA | Q&A en lenguaje natural sobre datos del tenant |
| Compliance | Si entra Enterprise: SOC2, ISO, BD dedicada |
| Partners | Programa de implementadores |
| SSO | Google / Microsoft / SAML |

---

## 4. MVP detallado (M0 → M6) por área

Para cada mes muestro objetivos por área. Mucho corre en paralelo: el orden es ilustrativo de cuándo "lidera" el foco, no excluyente.

### M0 — Setup y spine (mes 1)

**Foco principal:** infraestructura y framework, nada visible al usuario aún.

| Área | Entregables |
|---|---|
| Spine | Monorepo (Turborepo + pnpm). Apps `cliente` y `console` con Next.js bootstrap. Tailwind + shadcn copiados a `packages/ui`. ESLint + Prettier + tsconfig compartidos. CI básico (lint + typecheck). |
| Spine | Supabase project creado. Schema inicial: `tenants`, `users`, `internal_users`, `roles`, `user_roles`, `audit_log`. ORM elegido (Prisma vs Drizzle, decisión final acá). Migraciones inicial corriendo. |
| Spine | NextAuth configurado en ambas apps. Helper `withTenantContext` que setea `app.current_tenant_id` para RLS. |
| Spine | Vercel deploy de las 2 apps (preview por PR + prod). Dominios temporales OK. |
| Console | Login interno + listado de tenants vacío + crear tenant a mano. |

**Checkpoint M1:** logueo a Console interno, creo un tenant, las tablas existen y RLS funciona en tests.

### M1 — Modelo de datos + framework de integraciones (mes 2)

**Foco principal:** modelos canónicos + framework genérico de workflows.

| Área | Entregables |
|---|---|
| Datos | Schema completo del MVP (`people`, `people_history`, `areas`, `positions`, `locations`, `time_daily`, `absenteeism_events`, `absenteeism_types`, `payroll_*`, `termination_reasons`). RLS policies. |
| Datos | Tests RLS automatizados (suite). |
| Integraciones | Tablas `integration_templates`, `tenant_integrations`, `integration_runs`, `people_source_ids`. |
| Integraciones | Trigger.dev (o alternativa) integrado. Job runner genérico que toma `tenant_integration_id` y ejecuta el template asociado. |
| Console | UI de modelos de datos: activar/desactivar por tenant. |
| Console | UI de integraciones: catálogo + activar por tenant + configurar (mapping, filtros, schedule). |

**Checkpoint M2:** puedo activar manualmente una integración en Console, falla con un mock pero el framework anda.

### M2 — File-based integrations (mes 3)

**Foco principal:** el primer caso real end-to-end: subir un XLS y ver datos cargados.

| Área | Entregables |
|---|---|
| Integraciones | Template `file_people`: parser XLS/CSV/JSON, mapping configurable, upsert a `people` + `areas`/`positions`/`locations`. Reporte de errores por fila. |
| Integraciones | Template `file_time_attendance`: parser + upsert a `time_daily`. |
| Integraciones | Template `file_absenteeism`: parser + upsert a `absenteeism_events`. |
| Integraciones | Template `file_payroll`: parser + upsert a `payroll_*`. |
| Cliente | UI básica: login, layout, settings → integraciones → upload de archivos. |
| Cliente | Vista de `integration_runs`: histórico y detalle por run. |
| Datos | Job mensual de `people_history` (snapshot el día 1 de cada mes). |

**Checkpoint M3:** subo XLS de people/time/absenteeism/payroll desde Cliente, se cargan en BD del tenant, veo el run en UI.

### M3 — Dashboards core (mes 4)

**Foco principal:** los 4 dashboards funcionando contra la data cargada en M3.

| Área | Entregables |
|---|---|
| Cliente | Layout de dashboards + navegación. |
| Cliente | Dashboard 1: **Cubo / Headcount** completo (KPIs, visualizaciones, drill-down, página de detalle). |
| Cliente | Dashboard 2: **Ausentismos** completo (showcase ancla). |
| Cliente | Dashboard 3: **Horas extras** completo. |
| Cliente | Dashboard 4: **Turnover / Rotación** completo. |
| Cliente | Filtros globales (período, área, location). |
| Cliente | Exportación PDF básica de dashboard. |
| Cliente | Roles y permisos: visibilidad de dashboards configurable. |

**Checkpoint M4:** cargo datos del cliente ancla (vía XLS) y los 4 dashboards muestran info real, navegable.

### M4 — APIs Manú + Geovictoria (mes 5)

**Foco principal:** integraciones API que el cliente ancla efectivamente usa.

| Área | Entregables |
|---|---|
| Integraciones | Investigación + acceso a docs Manú/Geovictoria (lo antes posible, idealmente M0-M1). |
| Integraciones | Conector **API Manú**: extract con paginación, transform, upsert. Cron configurable. |
| Integraciones | Conector **API Geovictoria**: extract de marcaciones, agregación a `time_daily`, mapeo de licencias a `absenteeism_events`. |
| Integraciones | Reconciliación de identidades: tabla `people_source_ids`, matching auto + UI de matching manual. |
| Cliente | UI de "Personas no reconciliadas" + flujo de matching manual. |
| Console | Vista de salud de integraciones cross-tenant. |

**Checkpoint M5:** el cliente ancla está sincronizando data real desde Manú y Geovictoria todos los días, sin intervención manual recurrente.

### M5 — IA y página de detalle (mes 6 - primera mitad)

**Foco principal:** la capa de insights que diferencia a wlA.

| Área | Entregables |
|---|---|
| IA | Wrapper `packages/ai` con Vercel AI SDK. Provider abstraction (Llama default vía Groq/Together). |
| IA | Tabla `ai_usage` para tracking de costos. |
| IA | Console: configuración de LLM por tenant. |
| IA | Insights pre-armados: tabla + texto manual para métricas core. |
| IA | Insights automáticos: prompt templates que toman métricas + contexto y devuelven explicación / detección de anomalías. |
| Cliente | Página de detalle de cada dashboard: muestra fuente de datos + insights IA + insights pre-armados. |
| Cliente | Reportes exportables con insights. |

**Checkpoint M5.5:** abro un dashboard, voy a detalle, leo insights inteligentes y explicación de la métrica.

### M6 — Polish, ancla en prod, demos vendibles (mes 6 - segunda mitad)

**Foco principal:** pulir, validar y vender.

| Área | Entregables |
|---|---|
| Producto | Bug fixes, performance, UX polish. |
| Producto | Onboarding asistido del cliente ancla en prod (con todos los datos cargados). |
| Producto | Plantillas / dataset demo para mostrar a prospects sin exponer datos reales del ancla. |
| Operación | Documentación interna mínima (cómo onboardear un tenant, cómo resolver un error de integración común, cómo correr una integración manualmente). |
| Comercial | Material de demo: deck, captures, video de 2-3 min. |
| Comercial | 3 demos comerciales agendadas y ejecutadas con prospects. |

**Checkpoint MVP cierre:**

- ✅ Cliente ancla con >5 usuarios activos semanales durante 4 semanas.
- ✅ 3 demos cerradas con propuestas comerciales formales emitidas.

---

## 5. v1.x Post-MVP (M6 → M10)

Detalle más liviano (se refina al cerrar el MVP con feedback real).

### Polish y producto

- Ajustes UX según feedback del ancla y demos.
- Plantillas de dashboards aplicables out-of-the-box.
- Mejoras de IA en base a feedback (refinamiento de prompts, más insights pre-armados).
- Reportes PDF avanzados.

### Integraciones

- **SFTP / Email watched folder** (implementación, modelo ya existe).
- 1-2 conectores API adicionales según pipeline (Kaivia, RHPro, otros que pidan los prospects).
- Conector API a medida si un cliente lo paga (servicios profesionales).

### Operación

- Cobranza manual de suscripciones (factura mensual emitida por WinLabs).
- Dashboard de salud cross-tenant en Console (errores, runs, uso).
- Documentación pública de wlA para prospects/clientes (landing + docs básicos).

### Datos

- Evaluación de SCD2 para campos críticos (área, manager, salary_band) si snapshot mensual no alcanza.

### Comercial

- Onboardear 2-3 clientes adicionales con venta asistida.

**Cierre v1.x:** 2-3 clientes pagantes adicionales + onboarding más ágil + producto más pulido.

---

## 6. v2.x (M10+)

Vista direccional, sujeta a aprendizajes del MVP y v1.x.

| Bloque | Detalle |
|---|---|
| Self-serve | Signup público, wizard onboarding, tier Starter activable web, plantillas listas. |
| Billing | Stripe/MercadoPago, suscripciones automáticas, dunning, facturación electrónica país por país. |
| Verticales | Segundo paquete: Finance / CRM / Ventas (a priorizar según pipeline). Reutilizar el motor genérico. |
| IA | Q&A en lenguaje natural con semantic layer. Guardrails. |
| Compliance | SOC2 / ISO si entran clientes Enterprise. BD dedicada como upgrade. |
| Partners | Programa de implementadores, portal de partners, comisiones. |
| SSO | Google / Microsoft / SAML. |
| Mobile | App nativa si el mercado lo pide. |

---

## 7. Dependencias críticas (ruta crítica)

El gráfico abajo muestra qué bloquea qué dentro del MVP. Los nodos en mayúscula son los críticos (si se atrasan, atrasa el MVP).

```
SPINE (M0)
    │
    ├──► DATA MODEL (M1) ──► RLS TESTS ──► (todo lo demás depende de esto)
    │
    └──► AUTH (M0)  ─────────────────────────────────────────────────┐
                                                                     │
INTEGRATION FRAMEWORK (M1) ──► FILE TEMPLATES (M2) ──► DASHBOARDS (M3)
            │                                              │
            └──► API MANÚ (M4) ─┐                          │
            │                   ├─► RECONCILIATION ──► ANCLA EN PROD (M6)
            └──► API GEO (M4) ──┘                          │
                                                           │
                            IA WRAPPER (M5) ──► INSIGHTS ──┤
                                                           │
                                              DEMO MATERIAL ──► 3 DEMOS (M6)
```

**Nodos sensibles:**

- **Acceso docs APIs Manú/Geovictoria**: idealmente conseguir en M0. Si llega en M4, no llegamos a M6.
- **Acceso datos cliente ancla**: necesarios desde M3 para validar dashboards con data real. Si llegan en M5, atraso.
- **Decisión ORM (Prisma vs Drizzle)**: cerrar antes de M1.
- **Re-evaluación Trigger.dev vs Edge Functions**: cerrar al inicio de M1.

---

## 8. Riesgos del roadmap y mitigaciones

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-1 | Sos uno solo: enfermedad o imprevisto destroza el cronograma | Alto | Buffer de 1 mes implícito; comunicación temprana al ancla si hay desvío. |
| R-2 | APIs Manú/Geo más complejas de lo esperado | Alto | Investigación temprana (M0-M1). Plan B: file export desde esos SaaS como fallback. |
| R-3 | Cliente ancla no provee datos a tiempo | Alto | Negociar early access a un dump XLS desde M1. Tener datos sintéticos demo desde M2. |
| R-4 | Scope creep en dashboards / IA | Medio | Congelar los 4 dashboards en `02-alcance-y-fases.md`. Cambios pasan por `DECISIONS.md` y mueven release. |
| R-5 | Costos de Llama hosting más altos de lo proyectado | Bajo | Cap diario por tenant en `packages/ai`. Fallback a insights pre-armados si se excede. |
| R-6 | Performance de Postgres con queries complejas | Bajo | Índices proactivos en columnas dimensionales. Materialized views para dashboards si hace falta. |
| R-7 | Cliente ancla no firma contrato | Medio | Setup fee upfront para validar compromiso. Prospectar otros desde M3 para no depender de uno solo. |

---

## 9. Buffer y contingencias

- **Buffer implícito:** 1 mes entre "cierre MVP funcional" (~M5.5) y "ancla en prod + 3 demos" (M6).
- **Si M6 no es alcanzable:** cortar primero el dashboard de Turnover (es el menos crítico para el ancla). Después la API de Manú (file-based puede cubrir gap mientras se desarrolla). Mantener Ausentismos + Cubo intactos.
- **Si M6 es muy holgado:** adelantar SFTP/Email watched folder (v1.x) o empezar plantillas de dashboards para v1.x.

---

## 10. Cómo se actualiza este roadmap

- Cada checkpoint mensual (M0→M1, M1→M2, ...):
  - Revisar progreso real vs plan.
  - Actualizar las fechas si hay desvíos.
  - Mover items entre fases si hace falta.
  - Documentar el delta en una sección "Changelog" al final de este doc (próximamente).
- Cualquier decisión que cambie scope o secuencia → entrada en `DECISIONS.md`.

---

## 11. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-056 | Cadencia: flujo continuo + checkpoints mensuales | ✅ Cerrada |
| D-057 | Fechas relativas (M0…M10+), reanclables si arranque se mueve | ✅ Cerrada |
| D-058 | MVP por área con dependencias críticas explícitas | ✅ Cerrada |
| D-059 | Buffer de ~4 semanas implícito entre cierre funcional y cierre MVP | ✅ Cerrada |
| D-060 | Plan de corte (cuál dashboard / integración cortar primero si hay presión) | ✅ Cerrada |
| D-061 | Gestión: GitHub Issues + Project board, sin herramientas adicionales | ✅ Cerrada |

---

## 12. Decisiones abiertas

- **T0 efectivo** (fecha real de arranque): cuando lo decidas, anclamos las M0…M10.
- **Acceso a docs APIs Manú/Geovictoria**: gestionar antes de M0 idealmente.
- **Datos del cliente ancla**: negociar early access desde M0-M1.

---

## 13. Próximos pasos

→ Pasamos a **Fase 6: Convenciones y setup inicial** — `08-convenciones.md` y `09-setup-inicial.md`.

Cerraremos las convenciones de código, estructura de carpetas, manejo de errores, librerías aprobadas (extendiendo lo de `04-stack-tecnologico.md`), política de security review, y los pasos concretos de bootstrap del repositorio el día que arranques.
