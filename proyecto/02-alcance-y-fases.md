# 02 - Alcance y fases

> Documento de Fase 2. Define qué entra al MVP, qué queda para después, criterios de éxito y secuencia hasta v1.
> Última actualización: 2026-05-19.

---

## 1. Resumen ejecutivo

El proyecto se entrega en **tres fases productivas** después del setup inicial:

| Fase | Horizonte | Objetivo principal | Criterio de salida |
|---|---|---|---|
| **MVP** | T0 + 6 meses | Cliente ancla en producción con uso real + demos vendibles | Ancla live + 3 demos vendibles a prospects con datos reales |
| **v1.x — Post-MVP** | T0 + 6–10 meses | Pulir el motor, sumar conectores y vender con onboarding asistido | 2–3 clientes pagantes adicionales en venta asistida |
| **v2.x** | T0 + 10–18 meses | Self-serve + billing automático + nuevos verticales | Signup público + primer cliente pagando suscripción 100% self-serve |

> **Decisión clave 1**: separar self-serve de MVP. El MVP se enfoca en consolidar el cliente ancla y generar pipeline.
>
> **Decisión clave 2**: self-serve no entra a v1.x sino directamente a **v2.x**. v1.x es "expansión con venta asistida" — se valida el producto con más clientes reales antes de abrirlo al público.

---

## 2. Definición de fases

### 2.1 MVP (mes 0 → mes 6)

**Foco:** "El cliente ancla en producción y tres prospects que digan 'compro'".

**Entrega:**

- Motor genérico multi-tenant funcionando (la "spine").
- Paquete vertical **People Analytics** con 4 dashboards.
- File-based connectors + 2 API connectors (Manú y Geovictoria).
- Console mínima (alta de tenants, activación de modelos/integraciones, usuarios/roles).
- IA: insights automáticos sobre métricas + insights pre-armados.
- Onboarding **asistido** (no self-serve) — el equipo WinLabs configura cada tenant.

### 2.2 v1.x — Post-MVP (mes 6 → mes 10)

**Foco:** "Pulir lo que el cliente ancla nos enseñó y vender a 2–3 clientes más con onboarding asistido."

**Entrega incremental sobre el MVP (sin self-serve todavía):**

- Mejoras de IA insights basadas en feedback real del cliente ancla.
- Conectores API adicionales según pipeline (candidatos: Kaivia, RHPro, otros que pidan los prospects).
- Plantillas de dashboards aplicables out-of-the-box al activar People Analytics (acelera onboarding asistido).
- Manejo más robusto de errores de carga (formato XLS no esperado, columnas faltantes) — pero el onboarding sigue siendo asistido por el equipo WinLabs.
- Polish UI/UX general.
- Reportes PDF mejorados.
- Posible cobranza manual de suscripciones recurrentes (factura mensual emitida por WinLabs, no billing automático todavía).

### 2.3 v2.x (mes 10+)

**Foco:** "Que un PyME pueda registrarse desde la web, conectar un Excel y ver dashboards sin que llamemos a nadie + abrir nuevos verticales."

**Candidatos** (priorización en Fase 5 - Roadmap):

- **Self-serve**: signup público + wizard de onboarding + tier "Starter" activable desde la web.
- **Billing automatizado**: Stripe, MercadoPago u otro (a definir en Fase 4/5).
- Segundo vertical (a definir: Finance, CRM o Ventas).
- IA Q&A en lenguaje natural sobre los datos del tenant.
- Programa de partners / implementadores.
- SSO (Google/Microsoft/SAML).
- SOC2 / ISO si entran clientes Enterprise.
- Mobile responsive avanzado / app nativa si lo demanda el mercado.

---

## 3. MVP — Scope detallado

### 3.1 Lo que SÍ entra al MVP

#### Aplicación Cliente

- **Autenticación** propia (usuarios, login, recuperación de password). Sin SSO en MVP.
- **Roles y permisos** con visibilidad granular por dashboard.
- **4 Dashboards de People Analytics** (detalle en sección 4).
- **Página de detalle** por dashboard con: origen de datos, insights, recomendaciones.
- **Estado de integraciones** (cuáles activas, última corrida, detalle de ejecuciones).
- **Settings**: gestión de usuarios y roles del tenant; activación/desactivación de integraciones disponibles.
- **Exportación a PDF** de dashboard/reporte (básica, no personalizada).

#### Console interna (WinLabs)

- **Gestión de tenants**: alta, activación, suspensión.
- **Modelos de datos**: activar/desactivar por tenant.
- **Integraciones**: configurar conectores activos por tenant + reglas básicas del workflow.
- **Usuarios internos** WinLabs con roles (admin, operaciones, soporte).

#### Plataforma / Spine

- **Multi-tenancy** funcional desde el día uno (ver decisión de BD en Fase 3).
- **Framework de integraciones** tipo workflow: recolección → limpieza → update, con reglas parametrizables por cliente.
- **Framework de dashboards** con niveles de granularidad y página de detalle.
- **Logging y auditoría** básica (quién hizo qué, cuándo).
- **Capa de IA** para insights sobre métricas (no Q&A libre).

#### Integraciones del MVP

- **File-based**: XLS, CSV, JSON (workflow estándar lectura desde directorio/upload).
- **API Manú** (HR LatAm).
- **API Geovictoria** (Time & Attendance).

> Manú y Geovictoria son los dos sistemas que ya usa el cliente ancla. Cada uno es una API distinta — se desarrollan ambos en MVP.

#### IA del MVP

- **Insights automáticos** sobre métricas (detección de tendencias/anomalías, explicación en lenguaje natural).
- **Insights pre-armados** (texto escrito a mano para casos típicos: significado de la métrica, recomendaciones genéricas).
- **Sin Q&A libre** en lenguaje natural — eso entra a evaluación post-MVP.

### 3.2 Lo que NO entra al MVP

Explícitamente fuera de alcance, para evitar scope creep:

- ❌ **Self-serve / signup público** (queda para v1.0).
- ❌ **Billing automático / suscripciones online** (queda para v1.0).
- ❌ **SSO** (Google/Microsoft/SAML). Solo usuario+password.
- ❌ **Q&A en lenguaje natural** sobre datos del tenant.
- ❌ **Otros verticales** (Finance, CRM, Ventas).
- ❌ **Conectores API adicionales** (Kaivia, RHPro, etc.) — se evalúan después del MVP según pipeline.
- ❌ **Programa de partners** / portal de implementadores.
- ❌ **Mobile app nativa**. La web puede ser responsive, pero no hay app nativa.
- ❌ **Dashboards 100% Tailor-made desde UI** (drag & drop). MVP soporta variantes parametrizables, no constructor libre.
- ❌ **Compliance avanzado** (SOC2, ISO 27001). Se hacen buenas prácticas pero no certificación.
- ❌ **Facturación, contratos, partners** en Console (queda v1.0+).

---

## 4. Dashboards del MVP (detalle)

Cuatro dashboards en el paquete People Analytics, todos con **página de detalle** asociada (origen de info + insights IA).

| # | Dashboard | Propósito | Métricas/KPIs clave (primer corte) |
|---|---|---|---|
| 1 | **Cubo genérico / Headcount** | Vista panorámica de la población | Headcount total, distribución por área, ubicación, antigüedad, banda salarial, edad, género; slice & dice por dimensiones |
| 2 | **Ausentismos** | Showcase del cliente ancla | Tasa de ausentismo, tipos (médico, justificado, injustificado), costo asociado, tendencias, comparativo por área |
| 3 | **Horas extras** | Complemento ausentismos | Volumen HHEE, costo, distribución por área/jefatura, tendencia, comparativo |
| 4 | **Turnover / Rotación** | Métrica estándar People Analytics | Altas, bajas, tasa de rotación, motivos, antigüedad promedio al egreso, comparativo por área |

> Las métricas exactas y dimensiones se especifican en `05-modelo-datos.md` (Fase 4).

---

## 5. Criterios de éxito por fase

### 5.1 MVP (mes 6)

| # | Criterio | Cómo se mide |
|---|---|---|
| C-MVP-1 | **Cliente ancla en producción con uso real** | El cliente ancla usa la plataforma con sus datos reales y reemplaza al menos parcialmente la forma anterior de ver la información (Excels dispersos, planillas). Métrica: > 5 usuarios activos del cliente con uso semanal durante 4 semanas consecutivas. |
| C-MVP-2 | **Demos vendibles a 3 prospects nuevos** | 3 demos comerciales con datos del cliente ancla (o datos sintéticos representativos) que generen propuestas comerciales formales emitidas. |

### 5.2 v1.x — Post-MVP (mes 10)

| # | Criterio | Cómo se mide |
|---|---|---|
| C-V1-1 | **2–3 clientes pagantes adicionales en venta asistida** | Conversión de al menos 2 prospects (idealmente 3) post-ancla a clientes pagando (setup + suscripción, aunque la suscripción se cobre manualmente todavía). |
| C-V1-2 | **Reducción del tiempo de onboarding asistido** | El onboarding asistido (configurar tenant + conectar fuentes + activar dashboards) baja de X días a Y días gracias a plantillas y conectores extra (X/Y a fijar al inicio de v1.x con baseline del ancla). |

### 5.3 v2.x (mes 10+)

| # | Criterio | Cómo se mide |
|---|---|---|
| C-V2-1 | **Self-serve activo desde la web** | Un PyME puede registrarse, crear su tenant, conectar un XLS y ver dashboards sin intervención humana de WinLabs. Métrica: al menos 1 tenant activado 100% via self-serve, end-to-end. |
| C-V2-2 | **Primer cliente pagando suscripción 100% self-serve** | Primer cobro recurrente de suscripción cobrado automáticamente vía billing integrado, sin intervención manual. |

---

## 6. Timeline indicativo (alto nivel)

> Detalle por sprint/mes va en `07-roadmap.md` (Fase 5). Acá solo bloques gruesos.

```
M0 ─── M1 ─── M2 ─── M3 ─── M4 ─── M5 ─── M6 ─── M7 ─── M8 ─── M9 ─── M10 ─── M11+
│                                          │                              │
│  Spine + Console mínima + Auth           │  v1.x — Post-MVP             │  v2.x
│      │                                   │     │                        │
│      │  Framework integraciones          │     │  Más conectores API    │  Self-serve
│      │     │                             │     │     │                  │     │
│      │     │  File connector             │     │     │  Plantillas      │     │  Billing auto
│      │     │     │                       │     │     │     │            │     │     │
│      │     │     │  Manú + Geovictoria   │     │     │     │  IA mejoras│     │     │  Nuevos verticales
│      │     │     │     │                 │     │     │     │     │      │     │     │     │
│      │     │     │     │  Dashboards 1-4 │     │     │     │     │  UX  │     │     │     │
│      │     │     │     │     │           │     │     │     │     │ polish     │     │     │
│      │     │     │     │     │  IA       │     │     │     │     │      │     │     │     │
│      │     │     │     │     │  insights │     │     │     │     │      │     │     │     │
│      │     │     │     │     │     │     │     │     │     │     │      │     │     │     │
│                                  MVP cierre       v1.x cierre              v2.x cierre
│                                  cliente ancla   2–3 clientes              self-serve +
│                                  + 3 demos       pagantes asistidos        1er sub auto
```

(Diagrama indicativo — los bloques no son secuenciales puros; mucho corre en paralelo.)

---

## 7. Riesgos del MVP y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Manú/Geovictoria APIs cambian o son limitadas | Alto | Investigar docs ANTES de Fase 4; tener plan B con file export desde esos SaaS si la API no alcanza. |
| Cliente ancla no provee datos a tiempo | Alto | Negociar early access a un dump de datos sintetizables; tener datos demo desde mes 1. |
| Scope creep en dashboards | Medio | Congelar los 4 dashboards en el documento; cambios pasan por DECISIONS.md y mueven release date. |
| IA "alucinando" en insights | Medio | Empezar con insights pre-armados; los insights generativos arrancan acotados a métricas estructuradas, con tests. |
| Multi-tenant decisión equivocada de BD | Alto | Fase 3 cierra esa decisión antes de empezar build; un cambio post-MVP es muy caro. |
| Cliente ancla no termina pagando | Medio | Setup fee cobrado upfront cubre parte del desarrollo; prospectar en paralelo desde mes 3. |

---

## 8. Decisiones tomadas en esta fase

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

## 9. Decisiones abiertas

- Métricas y dimensiones exactas de cada dashboard (se cierran en `05-modelo-datos.md`).
- Stack tecnológico (Fase 3).
- Estrategia multi-tenant de BD (Fase 3) — bloquea inicio de build.
- Proveedor de billing para v1.0 (Stripe, MercadoPago, otro).
- Segundo vertical post-v1 (Finance vs CRM vs Ventas).
- Equipo: trabajás solo o contás con equipo en algún momento del MVP? (Impacta timeline.)

---

## 10. Próximos pasos

→ Pasamos a **Fase 3: Arquitectura y stack tecnológico** — `03-arquitectura.md` y `04-stack-tecnologico.md`.

Cerraremos: multi-tenant strategy (BD), separación Cliente/Console (monorepo vs polirepo), stack (frontend, backend, BD, IA), seguridad y CI/CD.
