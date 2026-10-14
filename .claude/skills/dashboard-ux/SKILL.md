---
name: dashboard-ux
description: Organizar y auditar dashboards analíticos para mejorar jerarquía, estructura, interacción y claridad de decisión. Usar al diseñar o revisar dashboards con métricas o información existente; no usar para definir KPIs estratégicos ni implementar frontend.
---

# Dashboard UX

## Purpose

Organizar, presentar y permitir explorar información analítica para que una audiencia comprenda qué está pasando y pueda decidir o actuar. Producir una especificación UX o una revisión priorizada, no una estrategia métrica, un catálogo de gráficos ni código.

## Use when

- Diseñar la estructura UX de un dashboard a partir de métricas o información ya definida.
- Auditar un dashboard existente y proponer mejoras concretas de jerarquía, agrupación, densidad o claridad.
- Definir overview, detail, navegación, filtros, drill-down o comparación.
- Revisar estados de datos, responsive behavior y requisitos preventivos de accesibilidad.
- Convertir un handoff de `product-analytics` en recomendaciones listas para implementación.

## Do not use when

- Falta definir qué KPIs, outcomes, drivers o guardrails deben medirse: usar `product-analytics`.
- El pedido requiere SQL, tracking, data modeling, pipelines o cálculo sobre datos.
- El pedido exige elegir encodings o visualizaciones especializadas como disciplina principal.
- El pedido es implementar React, CSS, componentes, librerías o comportamiento técnico.
- El objetivo principal es branding, marketing UI, landing pages o un design system completo.
- El pedido es análisis causal o una auditoría formal de conformidad de accesibilidad.

Ante “Necesito un dashboard”, determinar primero qué decisiones debe soportar y si existen métricas o información acordadas. Si no existen, pedir el contexto mínimo o secuenciar `product-analytics` antes de `dashboard-ux`. No inventar KPIs para poder continuar.

## Inputs

### Required / minimal

Obtener, aunque sea provisionalmente:

- **audience:** quién usa la experiencia y qué conoce;
- **decisions/tasks:** qué debe detectar, comprender, decidir o ejecutar;
- **metrics/information:** qué información ya está definida;
- **context of use:** frecuencia, presión temporal, dispositivo o entorno relevante.

Para Review mode, obtener además el dashboard o evidencia disponible —pantalla, capturas, descripción o estructura— y las restricciones conocidas.

No bloquear por información secundaria. Preguntar solo por faltantes que puedan cambiar materialmente la jerarquía, el modo o la interacción. Si el usuario prefiere avanzar, declarar supuestos reversibles y limitar las conclusiones a la evidencia disponible.

No inventar métricas, targets, thresholds, comparaciones, disponibilidad de datos ni comportamiento de usuarios. Si una ausencia cambia qué debería mostrarse, registrarla como gap o devolverla a `product-analytics`.

## Mode selection

Determinar primero el modo de trabajo:

- **Design:** crear una estructura UX nueva con información definida.
- **Review:** auditar una experiencia existente y priorizar correcciones.
- **Hybrid:** revisar lo existente y rediseñar solo las partes que lo necesiten.

Clasificar el dashboard como executive, operational, monitoring, diagnostic, exploratory o hybrid solo cuando eso cambie jerarquía, densidad o interacción. Para elegir el modo, ordenar información o corregir KPI walls y card soup, leer [references/modes-and-information-hierarchy.md](references/modes-and-information-hierarchy.md).

## Workflow

1. **Clarify audience and decision.** Precisar audiencia, tareas, decisiones, acciones, cadence y contexto; separar hechos, supuestos y gaps.
2. **Confirm the metric contract and data readiness.** Revisar información, definiciones, comparaciones, dimensiones, guardrails y freshness sin reabrir decisiones analíticas acordadas. Verificar además que las fuentes de datos existan y puedan cargarse (modelo, ingesta y datos de prueba) **antes de diseñar**; si no existen, registrar el gap y resolverlo primero en lugar de diseñar sobre datos supuestos.
3. **Identify dashboard mode.** Elegir un modo dominante cuando aporte valor; separar vistas o zonas si tareas incompatibles compiten.
4. **Identify primary questions and actions.** Formular qué debe comprenderse o hacerse primero.
5. **Inventory and prioritize information.** Relacionar cada elemento con orientación, decisión, acción, riesgo o explicación.
6. **Build overview → detail hierarchy.** Definir qué es primario, contextual, bajo demanda y metadata de confianza.
7. **Define comparison context.** Preservar medida, unidad, población, ventana, ancla y limitaciones relevantes.
8. **Define navigation, filtering and drill-down.** Elegir solo interacciones que reduzcan trabajo o complejidad neta.
9. **Define states and feedback.** Distinguir carga, ausencia, error, staleness, parcialidad, permisos y anomalías cuando apliquen.
10. **Validate density, scanability and responsive behavior.** Ajustar por experiencia, frecuencia, decisiones simultáneas y dispositivo.
11. **Validate accessibility.** Exigir keyboard access, foco, labels, contraste, non-color encoding y alternativas equivalentes.
12. **Produce implementation-ready UX recommendations.** Entregar estructura, prioridad, comportamiento, rationale, supuestos y gaps sin escribir código.

Comprimir el workflow para pedidos acotados. No obligar al usuario a completar una plantilla ni producir todas las secciones posibles.

## Design mode

1. Traducir decisiones y tareas a preguntas primarias del dashboard.
2. Priorizar el inventario por importancia, urgencia, coste de omisión y frecuencia de uso.
3. Definir secciones, agrupación y responsabilidades de overview, contexto y detail.
4. Especificar comparación, navegación, filtros, drill-down y estados pertinentes.
5. Preservar prioridades al describir responsive behavior y accesibilidad.
6. Entregar una especificación suficientemente concreta para implementación, con rationale y gaps.

No prescribir una composición visual universal. Explicar qué relación o prioridad debe expresar el diseño antes de sugerir cómo hacerlo.

## Review mode

1. Entender audiencia, decisiones, contexto y restricciones antes de juzgar la pantalla.
2. Identificar qué intenta comunicar la experiencia y qué camino propone hacia la acción o el detalle.
3. Describir problemas observables; distinguirlos de preferencias estéticas o hipótesis no verificadas.
4. Clasificar hallazgos como **critical**, **important** u **optional** según su efecto sobre comprensión, acción, error, tiempo o acceso.
5. Explicar por qué importa cada problema, qué cambio específico se recomienda y qué mejora después.
6. Conservar explícitamente lo que ya funciona.
7. Preferir cambios locales cuando resuelvan el problema; no rediseñar toda la pantalla por defecto.
8. Marcar como no verificables interacción, responsive behavior o estados que la evidencia disponible no permita observar.
9. Separar gaps analíticos de problemas UX y derivarlos sin inventar una solución métrica.

Para cada recomendación relevante, responder de forma recuperable:

- **What is wrong?**
- **Why does it matter?**
- **What should change?**
- **What improves after the change?**

Usar cuando aporte valor `Priority: High / Medium / Low`, `Impact: High / Medium / Low` y `Effort: Low / Medium / High`. Effort es una estimación UX relativa, no una estimación técnica precisa.

Evitar recomendaciones como “hacerlo más moderno”, “usar menos cosas”, “agregar más color” o “hacerlo más limpio”. Vincular cada cambio con una decisión, acción, error, tiempo, comprensión o accesibilidad.

## References under demand

Leer solo lo necesario:

- Para modos, prominencia, grouping, overview/detail, densidad, KPI walls o card soup, leer [references/modes-and-information-hierarchy.md](references/modes-and-information-hierarchy.md).
- Para comparisons, filtros, drill-down, cross-filtering, navegación o detail patterns, leer [references/exploration-and-comparison.md](references/exploration-and-comparison.md).
- Para loading, empty, no-data, error, stale, partial, permisos, anomalías o recovery, leer [references/states-and-feedback.md](references/states-and-feedback.md).
- Para keyboard, focus, labels, contraste, non-color encoding, información compleja o responsive hierarchy, leer [references/accessibility-and-responsive.md](references/accessibility-and-responsive.md).

- Para proyectos de WinLabs Analytics (audiencia, pantalla objetivo, estructura canónica, contrato de comparación, estados, exportación y antipatrones ya vistos), leer [references/wla-conventions.md](references/wla-conventions.md) además de las anteriores que apliquen.

No cargar todas las referencias por defecto ni tratarlas como checklists universales.

## Handoff from `product-analytics`

Consumir cuando exista:

- audience y decisions;
- prioritized metrics y metric roles;
- definitions;
- comparisons y dimensions;
- cadence/freshness;
- guardrails;
- gaps.

Usar ese contrato como input. No redefinirlo salvo detectar una inconsistencia, que debe formularse como pregunta o handoff.

## Output

### Design

Adaptar el formato al pedido. Una especificación completa puede incluir contexto y supuestos, audiencia, decisiones, modo, jerarquía, secciones, comparación, interacción, estados, responsive behavior, accesibilidad, rationale y gaps.

### Review

Usar de forma flexible:

```text
Current assessment
Critical issues
Recommended changes
Information hierarchy
Interactions and filters
States / responsive / accessibility
Keep as-is
Open questions
```

No forzar secciones vacías ni un wireframe. Mantener trazabilidad entre observación, impacto, cambio recomendado y beneficio esperado.

## Handoff to implementation

Entregar, cuando corresponda:

- vistas, secciones, orden, prioridad y grouping;
- relaciones overview/detail;
- comportamiento de filtros, selection, navegación, reset y drill-down;
- necesidades de comparación y representación;
- estados y feedback;
- reglas responsive semánticas;
- requisitos de accesibilidad;
- rationale, supuestos y gaps.

No entregar código, queries, eventos, APIs de componentes ni estimaciones técnicas precisas.

## Quality gates

Antes de finalizar, comprobar:

- [ ] La audiencia y la decisión principal están claras.
- [ ] Las métricas no fueron inventadas ni redefinidas.
- [ ] La jerarquía refleja importancia, urgencia o riesgo.
- [ ] Lo importante puede comprenderse rápidamente.
- [ ] Overview y detail están separados cuando corresponde.
- [ ] Las comparaciones conservan contexto.
- [ ] Los filtros y la interacción tienen propósito y no ocultan estado.
- [ ] Loading, empty, no-data, error, stale, partial, permisos y anomalías se contemplaron cuando aplican.
- [ ] La densidad corresponde al modo y contexto de uso.
- [ ] No se depende solo de color, hover o pointer.
- [ ] El responsive preserva prioridad, contexto y acciones críticas.
- [ ] En Review mode se conservaron elementos que ya funcionan.
- [ ] Cada recomendación relevante es específica, razonada y accionable.
- [ ] Los límites de la evidencia, assumptions y gaps están explícitos.
- [ ] Las fuentes de datos y su ingesta existen, o el gap está registrado y resuelto antes del diseño.
- [ ] En proyectos de WinLabs, el diseño respeta `references/wla-conventions.md`.
- [ ] No se invadieron `product-analytics`, data visualization especializada ni implementación.

## Anti-patterns

Evitar KPI walls, card soup, chart zoos, filtros sin propósito, comparaciones sin ancla, unidades ambiguas, drill-down sin retorno, modal navigation, forced symmetry, real-time por defecto, hover-only meaning, color como único indicador, confundir cero con no-data y ocultar contexto crítico en pantallas pequeñas.
