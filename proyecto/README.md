# WinLabs Analytics — Documentación de diseño

> Carpeta de **documentos de diseño** para el proyecto **WinLabs Analytics (wlA)**. Funciona como source of truth de visión, alcance, arquitectura, modelo de datos, roadmap, convenciones y estándares. Vive separada del código (que tendrá su propia documentación operativa en `/docs/`).
>
> Última actualización: 2026-05-19.

---

## 1. Cómo navegar este folder

| # | Documento | Para qué sirve |
|---|---|---|
| 00 | [`idea.md`](./idea.md) | Documento original con la idea sin estructurar. Punto de partida histórico. |
| 01 | [`01-vision-y-negocio.md`](./01-vision-y-negocio.md) | Visión, posicionamiento (independiente vs Kaivia), ICP, propuesta de valor, diferenciadores, modelo de negocio (Setup + SaaS + Servicios). |
| 02 | [`02-alcance-y-fases.md`](./02-alcance-y-fases.md) | Fases (MVP → v1.x → v2.x), scope IN/OUT del MVP, criterios de éxito, riesgos. |
| 03 | [`03-arquitectura.md`](./03-arquitectura.md) | Arquitectura macro: multi-tenancy (shared+RLS), monorepo, separación Cliente/Console, auth, integraciones, IA. |
| 04 | [`04-stack-tecnologico.md`](./04-stack-tecnologico.md) | Stack concreto: Next.js + Postgres/Supabase + Prisma + NextAuth + Vercel + Trigger.dev + IA multi-provider. Librerías aprobadas / prohibidas. |
| 05 | [`05-modelo-datos.md`](./05-modelo-datos.md) | Modelo canónico (People + Time + Payroll), history mensual, métricas y dimensiones de los 4 dashboards. |
| 06 | [`06-integraciones.md`](./06-integraciones.md) | Workflows ETL (File-based + Manú + Geovictoria), reconciliación de identidades, manejo de errores. |
| 07 | [`07-roadmap.md`](./07-roadmap.md) | Roadmap Now/Next/Later con detalle mes a mes del MVP por área, ruta crítica, plan de corte. |
| 08 | [`08-convenciones.md`](./08-convenciones.md) | Convenciones de código (idioma, TS strict, naming, error handling, testing, git, security review). |
| 09 | [`09-setup-inicial.md`](./09-setup-inicial.md) | Checklist secuencial día por día para arrancar el monorepo. BD local (dev) + Supabase (prod). Git manual. |
| 10 | [`10-estandares-y-skills.md`](./10-estandares-y-skills.md) | Estándares cross-cutting + skills reproducibles: nombres BD (taxonomía de prefijos), DBML+Prisma, layout AI-GEO, CRUD enterprise B2B, AI Agent user-facing, seeds, caché, auditoría. |
| — | [`DECISIONS.md`](./DECISIONS.md) | Log consolidado de decisiones (D-001 a D-105+) con su estado actual. |

---

## 2. Resumen ejecutivo del proyecto (1 pantalla)

**Producto**: WinLabs Analytics (alias `wl-Analytics` / `wlA`) — plataforma SaaS multi-vertical y multi-tenant de analytics, parametrizable por cliente, con dashboards "llave en mano", IA-driven insights, e integraciones SaaS LatAm out-of-the-box.

**Primer vertical**: People Analytics (Headcount + Ausentismos + Horas extras + Turnover).

**Cliente ancla**: empresa de servicios eléctricos (~500 empleados). ICP ampliado dual: mid-market regional + PyMEs self-serve.

**Modelo de negocio**: Setup inicial + SaaS suscripción + Servicios profesionales.

**Posicionamiento**: producto independiente de WinLabs. Kaivia (SaaS HR propio) es uno de los conectores potenciales.

**Stack**: Next.js 15 + TypeScript + Postgres+RLS sobre Supabase (prod) / Postgres local (dev) + Prisma + NextAuth + Vercel + Trigger.dev + Vercel AI SDK + Llama (Groq/Together) por default.

**Fases**:

| Fase | Horizonte | Foco |
|---|---|---|
| **MVP** | M0–M6 | Cliente ancla en producción + 3 demos vendibles |
| **v1.x Post-MVP** | M6–M10 | 2-3 clientes pagantes más, venta asistida |
| **v2.x** | M10+ | Self-serve, billing automático, nuevos verticales |

**M0 = mes de arranque del desarrollo**. Fechas relativas, no absolutas (no hay deadline duro).

---

## 3. Estado actual de cada fase de diseño

| Fase | Documentos | Estado |
|---|---|---|
| 1 — Visión y negocio | `01` | ✅ Cerrada |
| 2 — Alcance y fases | `02` | ✅ Cerrada (con ajuste self-serve → v2.x) |
| 3 — Arquitectura + stack | `03`, `04` | ✅ Cerrada |
| 4 — Modelo de datos + integraciones | `05`, `06` | ✅ Cerrada (ajustes menores se harán en implementación) |
| 5 — Roadmap | `07` | ✅ Cerrada |
| 6 — Convenciones + setup + estándares | `08`, `09`, `10` | ✅ Cerrada |
| 7 — Cierre (índice + DECISIONS) | `README.md`, `DECISIONS.md` | ✅ Cerrada |

Total: **~105 decisiones** tomadas (D-001 a D-105+, ver `DECISIONS.md`).

---

## 4. Cómo usar esta documentación en el día a día

### Para Winsy (founder / dev solo)

- **Antes de empezar M0**: leer `09-setup-inicial.md` y completar los pre-requisitos.
- **Antes de tomar cualquier decisión técnica nueva**: chequear si ya está documentada en alguna fase + `DECISIONS.md`.
- **Antes de implementar una feature**: aplicar los 6 pasos del §8.1 de `10-estandares-y-skills.md`.
- **Antes de crear o modificar una tabla**: aplicar SKILL 7 [CMP_DB_MODELING].
- **Antes de crear una Server Action de mutación**: aplicar SKILL 9 [AI_AGENT_TOOLING_INTEGRATION] (registrar tool del agente).
- **Antes de hacer seed**: aplicar SKILL 10.
- **Antes de cachear una query**: aplicar SKILL 11.
- **Al cerrar un módulo**: aplicar SKILL 6 [GENERATE_DOCUMENTATION] → genera `/docs/modules/<modulo>.md`.

### Para Claude Code (asistente de desarrollo)

- Leer `CLAUDE.md` en la raíz del repo (se crea en M0 con punteros a este folder).
- Operar dentro de los boundaries de `08-convenciones.md` §13 (security review) y `10-estandares-y-skills.md` §8.5 (qué no ejecutar).
- Disparar skills automáticamente cuando aplique el trigger.

### Para colaboradores futuros (v1.x+)

- Empezar por este `README.md`.
- Continuar con `01-vision-y-negocio.md` y `02-alcance-y-fases.md` para entender el "para qué".
- Después, sumergirse en el área que les toca (arquitectura, integraciones, dashboards, etc.).

---

## 5. Cómo se mantiene esta documentación

- Cada **checkpoint mensual** (M0→M1, M1→M2, ...) puede traer ajustes a los docs. Ver `07-roadmap.md` §10.
- Cualquier decisión técnica significativa → entrada en `DECISIONS.md` con número D-XXX, estado y descripción.
- Si una decisión cerrada cambia: marcarla como `🔄 Cambiada` con link a la nueva decisión que la reemplaza.
- Los documentos NO se sobreescriben silenciosamente: si un ajuste afecta múltiples docs, queda registrado el cambio en cada uno y en `DECISIONS.md`.
- Los docs de implementación (`/docs/`) son separados y se generan/actualizan con SKILL 6 a medida que se construye código.

---

## 6. Próximo paso

Decidir **T0** (fecha real de arranque del desarrollo) y ejecutar el checklist de `09-setup-inicial.md`.

Mientras tanto, decisiones abiertas que conviene cerrar (en orden de urgencia):

1. **Acceso a docs de APIs Manú y Geovictoria** (idealmente conseguir antes de M0).
2. **Acceso a datos del cliente ancla** (negociar early access desde M0-M1).
3. **Subdomain vs path-based** para tenants (bloquea middleware).
4. **Hex exacto del azul WinLabs** (placeholder `#1d4ed8`).
5. **Trigger.dev vs Supabase Edge Functions** (re-evaluar al iniciar Fase 4 / M1).
6. **Llama hosting**: Groq vs Together.ai vs Fireworks.
