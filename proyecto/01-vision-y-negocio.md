# 01 - Visión y modelo de negocio

> Documento de Fase 1. Define el "qué", el "para quién" y el "cómo se monetiza".
> Última actualización: 2026-05-19.

---

## 1. Resumen ejecutivo

**WinLabs Analytics** (alias interno: `wl-Analytics` / `wlA`) es una plataforma SaaS de analytics multi-vertical y multi-tenant, parametrizable por cliente, que consolida datos de múltiples fuentes y ofrece dashboards "llave en mano", insights y Q&A con IA, e integraciones SaaS listas para usar (foco inicial: LatAm).

El primer vertical productizado será **People Analytics** (People + Time & Attendance + Payroll, con foco inicial en ausentismos), para un cliente ancla del sector eléctrico de ~500 empleados. La arquitectura, sin embargo, se construye genérica desde el día uno para habilitar otros verticales (Finance, CRM, Ventas, etc.) en fases posteriores.

---

## 2. Visión

> "Que cualquier empresa pueda activar analytics de calidad, consolidados y accionables, en días — no en meses — sobre los sistemas que ya usa, sin armar un equipo de BI."

**Principios rectores:**

- **Genérico por diseño, vertical por entrega.** El core es un motor multi-tenant + framework de dashboards/integraciones. Lo que el cliente "compra" es un paquete vertical pre-armado.
- **Configurable sin código.** El cliente activa/desactiva modelos, integraciones y reglas desde la UI; el desarrollo a medida es la excepción, no la regla.
- **IA como capa de valor, no como gimmick.** La IA aporta insights, explicaciones de métricas y Q&A sobre datos reales del tenant.
- **Cercanía regional.** Integraciones con SaaS LatAm out-of-the-box (Manú, Geovictoria, Kaivia, RHPro, etc.) como diferencial defensible.

---

## 3. Posicionamiento estratégico

**Decisión:** WinLabs Analytics es un **producto independiente de WinLabs**, no un módulo de Kaivia. Kaivia (el SaaS de RRHH propio) será **uno de los conectores/consumidores** disponibles, no su "dueño".

**Implicaciones:**

- Marca, dominio, repos, infra y roadmap separados de Kaivia.
- Console y autenticación propios (no se reutilizan los de Kaivia).
- Kaivia entra como una integración estándar en el paquete People Analytics — igual que Manú, Geovictoria o RHPro.

**Mapa de productos WinLabs (alto nivel):**

| Producto | Tipo | Relación con wl-Analytics |
|---|---|---|
| Kaivia | SaaS HR vertical | Conector/origen de datos |
| WinLabs Analytics | Plataforma analytics multi-vertical | **Este proyecto** |
| (futuros) | — | Conectores o paquetes verticales adicionales |

---

## 4. Producto (vista alto nivel)

**Dos aplicaciones, una plataforma:**

1. **App Cliente** — lo que el cliente final usa día a día. Dashboards configurables, niveles de detalle, insights con IA, estado de integraciones, settings (usuarios, roles, activación de integraciones).
2. **Console (interna WinLabs)** — administración de tenants, contratos, suscripciones, modelos de datos, integraciones disponibles, facturación, partners.

**Capacidades centrales del MVP a nivel funcional** (detalle en `02-alcance-y-fases.md`):

- Multi-tenant con activación de modelos de datos por cliente.
- Framework de **integraciones** tipo workflow (recolección → limpieza → update) con reglas parametrizables por cliente.
- Framework de **dashboards** configurables con niveles de granularidad y página de detalle.
- **Insights con IA** sobre métricas y datos del tenant.
- Perfiles y roles con visibilidad granular (dashboards visibles según rol).
- Paquete vertical **People Analytics** instanciado sobre el framework.

---

## 5. ICP — Cliente ideal

**Cliente ancla (primer cliente real):**

- Empresa de **servicios eléctricos**, ~500 empleados.
- Ya usa soluciones específicas para People, Payroll y Time/Attendance, pero **sin analytics consolidado**.
- Dolor concreto: información descentralizada, ausentismos sin visibilidad consolidada.

**ICP ampliado para los primeros 12–18 meses (dual go-to-market):**

| Segmento | Canal | Ciclo de venta | Notas |
|---|---|---|---|
| **Anchor accounts** mid-market (200–1000 emp.) | Venta directa / referidos | Medio (semanas) | Foco real para revenue inicial; el cliente ancla cae acá. |
| **PyMEs pequeñas** (20–200 emp.) | Self-serve desde la web | Corto (días) | "Cola larga" via web; idealmente con onboarding guiado pero sin venta humana intensiva. |

**Implicaciones:**

- El producto necesita **dos modos de onboarding** (asistido para anchor accounts; self-serve para PyMEs pequeñas vía web).
- El pricing debe tener un **tier bajo accesible** para PyMEs y tiers superiores para mid-market.
- Geografía objetivo inicial: **LatAm** (reforzado por la estrategia de integraciones regionales).

---

## 6. Propuesta de valor y diferenciadores

**Propuesta de valor (pitch en 1 línea):**

> "Analytics consolidado de RRHH (y más adelante Finance/CRM/Ventas) listo en días, con IA que explica tus métricas, conectado a los SaaS que ya usás en LatAm — sin que tengas que armar un equipo de BI."

**Diferenciadores priorizados:**

1. **Verticalización + modelos listos.** Dashboards y métricas pre-armados por vertical (no se modela desde cero como en PowerBI/Tableau).
2. **IA-driven insights y Q&A.** Insights automáticos, explicación de métricas y preguntas en lenguaje natural sobre los datos del tenant.
3. **Integraciones SaaS LatAm out-of-the-box.** Conectores listos para Manú, Geovictoria, Kaivia, RHPro y otros — algo que las herramientas globales no traen.

**Diferenciadores complementarios (no son flagship pero suman):**

- Configurabilidad sin código (activación/desactivación de modelos e integraciones, reglas por cliente).
- TCO menor vs PowerBI + consultoría + integraciones a medida (se enfatiza solo como consecuencia, nunca como pitch principal — competir por precio es frágil).

**Contra quién competimos (mapa rápido):**

| Categoría | Ejemplos | Cómo ganamos |
|---|---|---|
| BI generalista | PowerBI, Tableau, Looker, Metabase | Verticalización + integraciones listas + IA aplicada |
| HR Analytics vertical | Visier, ChartHop, Crunchr | Multi-vertical, precio LatAm, integraciones regionales |
| BI a medida / consultoras | Implementaciones custom | Time-to-value, costo, no requiere consultora |

---

## 7. Modelo de negocio

**Modelo:** SaaS multi-tenant con tres líneas de revenue.

### 7.1 Setup inicial (one-time)

- Cobrado al inicio del contrato.
- Cubre onboarding, configuración de integraciones, alta de tenant y carga inicial.
- **Dos variantes:**
  - **Standard setup**: cliente entra con paquete vertical pre-armado y conectores estándar. Fee fijo.
  - **Setup con desarrollo a medida**: incluye integraciones custom, dashboards a medida, reglas específicas. Fee variable según scope.

### 7.2 Suscripción SaaS recurrente

- Cobrada mensual o anual (descuento por anual).
- Estructurada en **tiers** que se definirán en detalle más adelante (ver decisiones abiertas). Hipótesis inicial:
  - **Starter** (PyMEs): un vertical, modelos básicos, hasta N usuarios, integraciones estándar.
  - **Pro** (mid-market): más modelos por vertical, más usuarios, más integraciones, IA-insights activos.
  - **Enterprise**: multi-vertical, SLA, integraciones custom incluidas, soporte premium.
- Variables que entran al pricing (a definir): cantidad de modelos activos, usuarios, volumen de datos, integraciones activas.

### 7.3 Servicios profesionales (facturados aparte)

- Integraciones a medida fuera de catálogo estándar.
- Dashboards y reportes custom.
- Consultoría/training.
- Bolsas de horas pre-pagas para clientes Enterprise.

**Notas estratégicas:**

- El setup + servicios profesionales financian el desarrollo del cliente ancla y permiten validar el motor genérico sin depender de revenue recurrente desde el día uno.
- El objetivo a 18 meses es que la **suscripción supere el 60% del revenue** (señal de que el producto se sostiene como SaaS y no como consultoría disfrazada).

---

## 8. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-001 | Nombre formal: **WinLabs Analytics** (interno: `wl-Analytics` / `wlA`) | ✅ Cerrada |
| D-002 | Producto **independiente** de Kaivia. Kaivia es conector, no contenedor. | ✅ Cerrada |
| D-003 | MVP construye **motor genérico primero**, luego instancia People Analytics | ✅ Cerrada |
| D-004 | Modelo de negocio: **Setup inicial + SaaS suscripción + Servicios profesionales** | ✅ Cerrada |
| D-005 | ICP dual: anchor accounts mid-market + PyMEs self-serve via web | ✅ Cerrada |
| D-006 | Geografía inicial: **LatAm** | ✅ Cerrada |
| D-007 | Diferenciadores flagship: verticalización + IA insights + integraciones LatAm | ✅ Cerrada |

> Estas decisiones se replicarán en `/proyecto/DECISIONS.md` al cierre de la Fase 7.

---

## 9. Decisiones abiertas (pendientes)

Las dejo listadas para tomarlas en fases posteriores; no bloquean Fase 2.

- **Pricing concreto** (montos y variables exactas de cada tier). Se cierra después del MVP funcional, cuando tengamos al cliente ancla validando.
- **Nombre comercial "marketinero"** (opcional). `WinLabs Analytics` es el nombre formal; si más adelante surge un nombre más memorable para front-end de marketing, se evaluará. No bloquea desarrollo.
- **Política de free trial / freemium** para el canal self-serve.
- **Roadmap de verticales post-People** (Finance vs CRM vs Ventas — orden y prioridad).
- **Estrategia de partners** (consultoras, implementadores) — mencionada en `idea.md` pero a definir cuando tengamos producto.

---

## 10. Próximos pasos

→ Pasamos a **Fase 2: Alcance y fases (MVP / Post-MVP)** — `02-alcance-y-fases.md`.

El objetivo de la próxima fase es definir qué entra y qué no entra al MVP, con qué criterios de éxito, y cómo se rampa hacia v1 y siguientes.
