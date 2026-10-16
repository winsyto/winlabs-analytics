# SKILL: ADD_DASHBOARD

**Trigger:** cuando se deba agregar o modificar un dashboard de People Analytics.

**Implementaciones de referencia:** Dashboard 1 (Headcount): `apps/cliente/app/(dashboard)/headcount/` y `docs/modules/dashboard-headcount.md`; Dashboard 2 (Ausentismos, con motor de cálculo propio y meta): `apps/cliente/app/(dashboard)/absenteeism/` y `docs/modules/dashboard-ausentismo.md`. Copiar su estructura, no reinventarla.

**Otras referencias:**
- Diseño: skill `dashboard-ux` (`.claude/skills/dashboard-ux/`), más `references/wla-conventions.md` (convenciones de este proyecto). Es obligatorio para el diseño; no se implementa antes de que el usuario apruebe el diseño funcional y visual.
- Métricas y dimensiones del producto: `proyecto/05-modelo-datos.md` §6.
- Modelo de unidades organizativas: `docs/modules/unidades-organizativas.md`.
- Carga de datos: `docs/modules/carga-de-archivos.md`.

---

## Dashboards del MVP (M3)

| # | Dashboard | Estado | Fuentes | Notas |
|---|---|---|---|---|
| 1 | Headcount / Cubo | Completo | `hr_people`, `hr_people_history`, `hr_people_org_assignments` | Referencia |
| 2 | Ausentismos | Completo en local (falta el anexo E4) | `att_absenteeism_events`, `cfg_absenteeism_types`, `hr_shift_schedules`, `hr_people`, `hr_people_org_assignments` | Motor SQL de tramos y piezas (`docs/modules/dashboard-ausentismo.md`); meta por tenant, default 4% mensual |
| 3 | Horas extras | Pendiente | `att_time_daily` y entradas con categoría `overtime` | Benchmark por defecto 10% sobre horas regulares |
| 4 | Turnover / Rotación | Pendiente | `hr_people` (bajas y motivos), `hr_people_history` (headcount promedio), `cfg_termination_reasons` | Benchmark por defecto 18% anual |

Se construyen **de a uno**: se cierra y ajusta uno antes de diseñar el siguiente, aplicando lo aprendido.

---

## Procedimiento

### 0. Puerta de datos (antes de diseñar)
Verificar que cada fuente del dashboard **existe y se puede cargar**. Si falta algo, resolverlo primero (fue la lección más cara del Dashboard 1: sin el modelo de unidades con vigencia y los archivos con sus dimensiones no había datos reales que mostrar).

- [ ] Tablas y columnas necesarias existen y tienen RLS.
- [ ] Hay un template de archivo (o integración) que las carga, con sus validaciones y un archivo de ejemplo en `apps/cliente/public/examples/` (generado con `jobs/worker/scripts/generate-examples.ts`).
- [ ] Los datos que necesitan una referencia mensual (denominadores, tasas) tienen cierres mensuales o una forma definida de calcularlos.
- [ ] Las dimensiones del dashboard se resuelven por unidad organizativa **con vigencia** (unidad en la fecha del evento).
- [ ] Hay datos de prueba suficientes en local para todos los estados (con datos, vacío, sin resultados, parcial).

### 1. Descubrimiento y diseño (skill `dashboard-ux`)
Definir y validar con el usuario: audiencia y decisiones, KPIs con su definición y fórmula, período, granularidad y comparación, dimensiones y filtros, estados, layout para 15.6" sin scroll, acciones (drill-down, exportación) y qué queda fuera. Registrar los gaps de producto (benchmarks, metas, permisos).

### 2. Plan de implementación
Presentar un plan detallado (archivos, consultas, verificación, riesgos, preguntas) y esperar aprobación antes de escribir código.

### 3. Implementación

Estructura (dentro de `apps/cliente/app/(dashboard)/<dashboard>/`):

```
page.tsx                      ← resumen (Server Component)
loading.tsx                   ← esqueleto sin valores falsos
[scope]/[[...id]]/page.tsx    ← drill-down con breadcrumb, paginación, búsqueda y orden
export/route.ts               ← Excel y PDF
_data/                        ← capa de datos: filters, hrefs, period, queries, detail-queries, types
_components/                  ← gráficos y barra de filtros (client components)
_export/                      ← report.ts, xlsx.ts, pdf-document.tsx
```

Kit compartido en `apps/cliente/app/(dashboard)/_dashboard-kit/` (reutilizar, no duplicar): `DashboardShell` / `PendingRegion` / `useDashboardParams` (parámetros de URL y carga localizada), `MetricCard`, `ChartCard` y `ChartDataTable`, `MultiSelectFilter`, `PeriodSelector`, `FreshnessBadge`, `DashboardEmpty` / `DashboardNoResults`, `Breadcrumb`, `ExportMenu`, `format`.

**Reglas de la capa de datos**
- Todo acceso a tablas de tenant va por `withTenantContext`; las consultas agregan en SQL (nunca traer filas para sumar); validar parámetros con Zod en el borde.
- El estado (período, filtros, orden, página) vive en la URL. Parámetros de filtro: `f_<tipo>`; cada dashboard tiene el suyo.
- Las dimensiones salen de `dsh_dimensions` (no se asumen nombres). Ver `headcount/_data/dimensions.ts`.
- Para eventos (altas, bajas, ausencias...) filtrar por la unidad **vigente en la fecha del evento**; para cierres, por las unidades del cierre.
- Un valor "Sin asignar" siempre filtrable; "none" en la URL.
- Reutilizar la lógica de períodos y comparación de `headcount/_data/period.ts`.
- El cálculo de cada KPI se documenta en el doc del módulo (contrato de métricas).

**Estados obligatorios:** carga, vacío (con siguiente paso), sin resultados (con "Limpiar filtros"), desactualizado (más de 45 días), historial con huecos, comparación no disponible, 404 para rutas o ids inválidos.

**Accesibilidad:** resumen y tabla equivalente por gráfico, no depender solo del color, teclado operable, etiquetas con unidad y período.

**Exportación:** Excel por hojas y PDF paginado y estructurado, respetando período y filtros, con cabecera de filtros y fechas, y tope de filas.

### 4. Verificación (no se cierra sin esto)
- [ ] Typecheck de todos los paquetes tocados.
- [ ] Números del dashboard **contra SQL independiente** con filtros distintos (con datos de prueba armados a propósito para los casos de borde).
- [ ] Entra en 1536×730 sin scroll; probado con una, varias y más dimensiones de las habituales.
- [ ] Estados probados (vacío, sin resultados, filtros combinados, URLs inválidas).
- [ ] Exportaciones descargan y coinciden con la pantalla.
- [ ] Prueba de punta a punta con archivos (ver `docs/runbooks/prueba-local-de-archivos.md`) si cambió la ingesta.
- [ ] Probado en producción tras el deploy, con la secuencia de `docs/runbooks/deploy-migraciones-y-worker.md` si hubo migración o cambios en el worker.

### 5. Cierre
- [ ] Documentar el módulo con `GENERATE_DOCS` (`docs/modules/dashboard-<nombre>.md`), incluyendo "Ajustes y aprendizajes".
- [ ] Actualizar `BACKLOG.md` y `proyecto/DECISIONS.md`.
- [ ] Si se descubrió algo que sirve a los próximos dashboards, ajustar este skill y `dashboard-ux/references/wla-conventions.md`.
- [ ] Revisar el diseño del siguiente dashboard con lo aprendido antes de empezar.

---

## Lo que dejó el Dashboard 2 (ya generalizado)
- Al kit pasaron `period.ts`, `dimensions.ts` (`getDashboardDimensions(tenantId, código)`) y `dimension-filters.ts` (`f_<tipo>`, `none`). `MetricCard` admite `formatValue`, `formatDiff`, `formatAvg` y contenido propio (`children`).
- `DASHBOARD_CODES` y `applyDefaultOrgConfig` recorren todos los dashboards (`DEFAULT_DASHBOARD_DIMENSIONS`); el CMP muestra y restaura las dimensiones de cada dashboard.
- **Metas por tenant:** `cfg_tenant_metric_targets` + `METRIC_TARGET_DEFAULTS` (`absenteeism_rate`, `overtime_rate`, `turnover_rate`); se editan en `/settings/targets`. Un dashboard nuevo solo agrega la métrica a la lista de esa pantalla.
- **Si el dashboard necesita un cálculo propio (tasas, horas, exposición):** hacerlo en SQL, evaluar el motor **una sola vez** por pantalla (CTE materializado) y reutilizarlo en el detalle y las exportaciones. Ver `absenteeism/_data/engine.ts` y las lecciones de rendimiento del doc del módulo.
- **Verificación independiente:** un script que arme un tenant temporal con casos de borde y compare contra una implementación día por día (`apps/cliente/scripts/verify-absenteeism-engine.ts`).
- Pendiente de generalizar al repetirse: el filtro de período de `queries.ts` (`resolveRange`) y los componentes de gráfico de barras con meta.

## Pendiente de producto (posterior a los 4 dashboards)
Hub de dashboards (una sola opción de menú que lleva a todos), administración en el CMP de qué dashboards están activos por tenant y permisos por opción de menú. Ver `BACKLOG.md`.

## Errores comunes (ver el doc del módulo para el detalle)
Consultas a tablas con RLS sin contexto de tenant, `withTenantContext` con el límite de 5 s en consultas analíticas (usar `{ timeout }`), medir rendimiento con tablas sin `ANALYZE` o con argumentos constantes, filtros por el estado actual en vez del vigente en la fecha del evento, contenedores de gráficos sin altura definida, tablas `sr-only` sin envolver, filtros o paneles escritos para dimensiones concretas.
