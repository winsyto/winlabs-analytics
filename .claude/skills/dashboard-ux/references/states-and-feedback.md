# Estados y feedback

Usar esta referencia cuando disponibilidad, calidad, freshness, permisos o actualización dinámica cambien la interpretación o la acción. Los estados son parte del significado del dashboard, no mensajes accesorios.

## Clasificar antes de diseñar

| Estado | Significado | Respuesta UX conceptual |
| --- | --- | --- |
| Loading | La información todavía no está disponible | Mantener orientación, indicar alcance y evitar falsa precisión |
| Empty | Aún no existe contenido o configuración | Explicar qué aparecerá y cuál es el siguiente paso, si existe |
| No-data | No hubo observaciones válidas para el alcance | Diferenciar de cero, error y permisos |
| No-results | Los filtros o la búsqueda no encontraron coincidencias | Mostrar el contexto activo y ofrecer ajuste o reset |
| Error | No pudo obtenerse o procesarse información | Aclarar alcance, conservar contenido válido y ofrecer recuperación posible |
| Stale | La última actualización excede la tolerancia acordada | Mostrar timestamp, impacto y acción; no presentar como actual |
| Partial | Solo parte de la cobertura está disponible | Indicar cobertura y limitar la interpretación |
| Permission-limited | La persona no puede ver una parte | Explicar el alcance sin revelar datos sensibles y orientar sobre acceso |
| Anomalous | Una condición acordada requiere atención | Mostrar magnitud, contexto, prioridad y camino a diagnóstico o acción |

No usar cero, guion, celda vacía y error como equivalentes. Si la causa no puede conocerse, comunicar incertidumbre en lugar de adivinar.

## Diseñar cada estado

Definir según corresponda:

1. **Meaning:** qué está ocurriendo.
2. **Scope:** qué sección, métrica, período o población afecta.
3. **Trust:** qué contenido sigue siendo válido y qué no debe interpretarse.
4. **Timing:** última actualización, progreso o expectativa útil, sin promesas inventadas.
5. **Action:** esperar, reintentar, ajustar filtros, configurar, pedir acceso o investigar.
6. **Recovery:** cómo volver al estado normal y qué contexto se conserva.

Evitar mensajes genéricos cuando una distinción cambia la decisión. No sobrecargar estados obvios con explicaciones extensas.

## Loading

Distinguir carga global de localizada:

- Usar carga global cuando todavía no puede entenderse ninguna parte confiable de la vista.
- Mantener navegación, filtros y contenido válido cuando solo se actualiza una región.
- Preservar la estructura para evitar saltos que dificulten orientación.
- Indicar cuando un cambio de filtro está recalculando datos para que el usuario no mezcle contextos.
- Evitar skeletons que parezcan valores reales o que prometan una forma incorrecta del contenido.

No bloquear toda la interfaz si existen acciones seguras e independientes.

## Empty, no-data y no-results

### Empty

Usar cuando la persona o el sistema todavía debe crear, configurar o conectar algo. Explicar el propósito futuro y ofrecer una acción solo si pertenece a su rol.

### No-data

Usar cuando el período o población son válidos pero no contienen observaciones. Conservar alcance, período, unidad y filtros para que no se confunda con un fallo.

### No-results

Usar cuando una consulta válida produjo cero coincidencias. Mostrar filtros o búsqueda responsables y ofrecer reset o ajuste. No borrar el contexto que explica el resultado.

## Error y recuperación

Identificar si el error afecta:

- toda la vista;
- una sección;
- una métrica;
- una acción;
- una actualización en segundo plano.

Conservar datos previos solo si siguen siendo útiles y etiquetarlos con su timestamp o limitación. No reemplazar información válida por un error global si el fallo es localizado.

Proponer reintento únicamente cuando sea razonable. Si la recuperación depende de otra persona o sistema, explicar el siguiente paso sin prometer resolución.

## Freshness y stale data

La visibilidad de freshness depende de:

- cadence de decisión;
- velocidad esperada del fenómeno;
- tolerancia acordada;
- riesgo de actuar con información antigua;
- diferencias de actualización entre fuentes.

Hacer visible freshness cerca de la información cuando cambie su interpretación. Si varias fuentes tienen edades distintas, evitar un timestamp global engañoso.

Para stale data expresar:

- última actualización conocida;
- alcance afectado;
- consecuencia para la decisión;
- acción o expectativa disponible.

No recomendar tiempo real por defecto. Una actualización más frecuente que la capacidad de actuar añade ruido y coste sin mejorar decisiones.

## Partial data

Declarar cobertura por período, segmento, fuente o entidad según corresponda. Evitar:

- agregados que parezcan completos;
- comparaciones con un lado incompleto sin advertencia;
- precisión visual superior a la confianza disponible;
- inferencias sobre poblaciones ausentes.

Permitir continuar cuando la parte disponible sostenga una decisión segura; si no, bloquear esa conclusión, no necesariamente toda la vista.

## Permission-limited

Distinguir falta de permiso de ausencia de datos. Comunicar qué categoría de información está limitada sin revelar nombres, conteos o existencia sensible. Indicar el proceso de acceso solo si se conoce.

No usar espacios reservados que permitan inferir datos protegidos por posición, longitud o comparación.

## Anomalías y alertas

Una anomalía visible debe basarse en una regla o señal ya acordada. Mostrar:

- qué cambió y cuánto;
- comparison anchor y período;
- nivel de prioridad o riesgo;
- freshness y confianza;
- entrada a diagnóstico o acción.

No transformar toda variación en alarma. Evitar depender solo de color, animación o posición. Si el threshold no existe o es dudoso, marcar el gap para `product-analytics`.

## Feedback de interacción

Al cambiar filtros, selección o scope:

- mostrar el estado activo y las regiones afectadas;
- comunicar carga o actualización localizada;
- conservar acciones seguras;
- permitir deshacer o resetear cuando el cambio sea reversible;
- evitar que valores de contextos distintos convivan como si fueran comparables;
- anunciar cambios relevantes para assistive technology en el handoff.

## Checklist de revisión

- Cero, vacío, no-data, no-results y error son distinguibles.
- El alcance de loading o error es proporcional y visible.
- Contenido previo se conserva solo con freshness y confianza claras.
- Datos stale o parciales limitan explícitamente la interpretación.
- Permission-limited no filtra información sensible.
- Anomalías incluyen contexto y camino a acción o diagnóstico.
- Cada recovery path es posible y pertinente para la audiencia.
- Los cambios dinámicos tienen feedback perceptible y no dependen solo de color.
