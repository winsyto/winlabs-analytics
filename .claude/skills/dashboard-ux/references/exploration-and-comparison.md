# Exploración y comparación

Usar esta referencia cuando el dashboard necesite comparison context, filtros, navegación, búsqueda, selección o detalle interactivo. Diseñar la interacción desde la pregunta, no desde un catálogo de componentes.

## Contrato de comparación

Antes de decidir cómo presentar una comparación, recuperar:

- medida y unidad;
- población, entidad o segmento;
- período o ventana;
- ancla: target, período previo, baseline, benchmark, cohorte u otro actor;
- dirección y magnitud del cambio;
- freshness, cobertura o limitaciones relevantes.

`product-analytics` decide qué comparación es válida. `dashboard-ux` decide cuál necesita presencia inmediata, cuál queda disponible bajo interacción y cómo se conserva su contexto.

Si existen varias anclas:

1. Priorizar la que responde la decisión principal.
2. Mantener las secundarias descubribles sin mostrarlas todas simultáneamente.
3. Explicar si cambiar el ancla modifica período, población o interpretación.
4. Evitar comparar ventanas incompletas o poblaciones incompatibles como equivalentes.

No inventar targets ni benchmarks. Mostrar su ausencia como gap cuando impida interpretar.

## Necesidades representacionales

Puede recomendarse una necesidad de representación:

- **tendencia:** cambio a través del tiempo;
- **ranking:** orden relativo entre entidades;
- **composición:** contribución de partes a un total;
- **distribución:** variabilidad, concentración o extremos;
- **relación:** asociación entre medidas;
- **estado:** situación actual frente a una regla acordada;
- **detalle tabular:** lectura precisa, comparación fila a fila o acción por entidad.

No convertir estas familias en recetas rígidas de charts. Si la elección concreta depende de encodings, escalas o percepción especializada, marcar el handoff a data visualization.

## Elegir interacción por propósito

| Patrón | Usar para | Condiciones y costes |
| --- | --- | --- |
| Filter | Acotar población o contexto | Definir alcance, default, estado activo, persistencia y reset |
| Drill-down | Profundizar una jerarquía | Preservar origen, filtros, comparación y retorno |
| Cross-filtering | Coordinar vistas relacionadas | Hacer visible la selección y permitir deshacerla |
| Tabs | Separar perspectivas pares o modos | No ocultar información crítica ni usar como navegación profunda |
| Search | Localizar entidades | Útil cuando navegar o filtrar sería costoso; mostrar alcance y no-results |
| Inline detail | Revelar contexto local | Adecuado para detalle breve sin perder posición |
| Drawer | Consultar detalle medio conservando contexto | Evitar cadenas de drawers y contenido demasiado profundo |
| Modal | Foco temporal o decisión acotada | No usar como navegación analítica principal |
| Selection | Comparar o actuar sobre elementos | Estado perceptible, reversible y accesible |
| Hover | Aportar información complementaria | Nunca ser único acceso a significado esencial |

Toda interacción debe reducir más trabajo del que añade. Considerar memoria de estado, pasos, riesgo de desorientación, uso en touch, keyboard access y posibilidad de compartir o volver a la vista.

## Estrategia de filtros

Para cada filtro, justificar:

- qué decisión o diagnóstico puede cambiar;
- quién lo usa y con qué frecuencia;
- qué contenido afecta;
- cuál es el default y por qué;
- si persiste entre sesiones o vistas;
- cómo se muestra su estado activo;
- cómo se elimina o restablece;
- qué ocurre con agregados, comparaciones y URLs compartidas.

Mantener visibles los filtros activos aunque los controles se compacten. Evitar que la vista parezca global cuando está filtrada.

No exponer todas las dimensiones disponibles. Llevar cortes infrecuentes al flujo diagnóstico o a detail cuando no apoyen decisiones habituales.

## Drill-down y continuidad

Un drill-down útil debe:

- partir de una pregunta o señal identificable;
- profundizar una relación real, no solo abrir más datos;
- conservar entidad, período, filtros y comparison anchor;
- indicar la profundidad y permitir regresar o resetear;
- evitar que el usuario reconstruya manualmente el contexto;
- terminar cuando el siguiente nivel corresponde a otra tarea o herramienta.

Elegir navegación a otra vista cuando el detalle necesita mucho espacio, URL propia, workflow prolongado o una audiencia diferente. Elegir inline detail o drawer cuando la continuidad espacial sea más valiosa que la profundidad.

## Comparison overload

Señales de sobrecarga:

- demasiados períodos, segmentos o targets compiten simultáneamente;
- el usuario no puede reconocer el ancla principal;
- filtros cambian solo una parte de la comparación;
- leyendas o controles ocupan más atención que el patrón;
- se mezclan unidades, escalas o ventanas;
- segmentos pequeños parecen concluyentes.

Responder mediante prioridad, progressive disclosure, small multiples conceptuales, selección explícita o vistas separadas según la tarea. No resolver ocultando silenciosamente contexto ni prescribiendo un chart específico.

## Casos especiales

### Cohorts

Conservar ancla, edad comparable y maduración. Hacer visible cuándo una cohorte reciente está incompleta.

### Targets y thresholds

Distinguir target aspiracional, compromiso operativo y threshold de alerta si el contrato los separa. No convertir automáticamente todo target en alarma.

### Segmentos pequeños o datos parciales

Mostrar limitación y cobertura junto a la comparación. Evitar prominencia o precisión que exceda la confianza disponible.

### Cross-filtering

Indicar qué selección está activa, qué vistas cambió y cómo volver al estado anterior. Ofrecer alternativa equivalente a pointer y hover.

## Checklist de revisión

- La comparación principal responde la pregunta prioritaria.
- Unidad, población, ventana y ancla son recuperables.
- Comparaciones secundarias son descubribles sin dominar.
- Los filtros tienen propósito, alcance, estado activo y reset claros.
- El drill-down preserva contexto y retorno.
- La interacción funciona conceptualmente con teclado y touch.
- No se oculta significado esencial en hover.
- Ventanas incompletas, segmentos pequeños y datos parciales limitan la lectura.
- No se inventaron comparaciones ni se impuso un chart type.
