# Accesibilidad y responsive behavior

Usar esta referencia al producir una especificación completa, revisar información visual compleja o trabajar con varios dispositivos y modalidades. Definir requisitos observables; una auditoría formal y la reparación técnica pertenecen a capacidades especializadas.

## Principio central

Preservar la misma decisión, prioridad y significado aunque cambien viewport, input o forma de percepción. Responsive no es solo reflow; accesibilidad no es solo contraste.

## Keyboard y foco

Exigir que las funciones disponibles con pointer puedan realizarse con teclado cuando corresponda:

- recorrer controles y regiones en un orden coherente con la jerarquía;
- reconocer el foco sin depender de color sutil;
- abrir y cerrar detail patterns sin quedar atrapado;
- operar filtros, tabs, selección, tablas y acciones;
- omitir bloques repetitivos cuando la superficie sea extensa;
- volver al origen después de cerrar o completar una interacción.

No prescribir atributos o código salvo que el pedido sea un handoff técnico separado. Describir el comportamiento esperado.

## Labels, nombres y estructura

Cada métrica, control, icono y región debe tener un nombre comprensible para la audiencia. Hacer recuperables:

- medida y unidad;
- período y población;
- comparison anchor;
- estado y freshness;
- alcance de filtros;
- acción disponible y consecuencia.

El reading order debe expresar la misma jerarquía que la presentación visual. No usar posición, iconografía o abreviaturas internas como única explicación.

## Color, contraste y formas alternativas

No depender solo de color para comunicar:

- estado o severidad;
- selección;
- tendencia positiva o negativa;
- pertenencia a una serie;
- anomalía;
- éxito o error.

Combinar cuando corresponda texto, signo, patrón, forma, posición o label. Exigir contraste suficiente para texto, controles, foco y objetos gráficos necesarios para comprender.

No asumir que verde significa bueno o rojo malo: el sentido depende de la métrica y debe ser explícito.

## Charts e información compleja

Cuando una representación visual porte información esencial, definir un equivalente útil, no solo un nombre genérico:

- resumen textual del patrón o cambio relevante;
- valores clave recuperables;
- tabla o detalle estructurado cuando se necesite precisión;
- labels asociados a series y puntos relevantes;
- explicación de unidad, período y comparación;
- acceso equivalente a información mostrada en hover.

El equivalente debe permitir la tarea principal. No es necesario verbalizar cada punto si una síntesis más una tabla accesible conserva significado y acción.

## Contenido dinámico

Definir feedback perceptible para:

- loading y finalización;
- errores;
- aplicación o eliminación de filtros;
- actualización de una región;
- cambios de selección;
- aparición de alertas relevantes.

Evitar anuncios excesivos que interrumpan el trabajo. Priorizar cambios que alteran contexto, confianza o siguiente acción.

## Responsive hierarchy

En cada tamaño o contexto, preservar:

1. orientación y alcance;
2. señales primarias;
3. comparison context necesario;
4. estado y freshness críticos;
5. acciones frecuentes;
6. acceso reconocible a detail.

Cambiar orden, agrupación o patrón de detalle antes de reducir contenido hasta volverlo ilegible. No eliminar unidades, filtros activos, estado o freshness para ahorrar espacio.

Definir comportamiento semántico, no breakpoints, CSS ni componentes concretos.

## Desktop denso y pantallas menores

### En desktop denso

- favorecer alineación y comparación estable;
- evitar que paneles simultáneos compitan sin prioridad;
- mantener navegación y filtros cerca de su alcance;
- permitir lectura tabular cuando la tarea exige precisión;
- conservar un orden lógico independiente de la posición visual.

### En tablet o mobile

- reordenar según decisión, no según orden accidental del DOM o grilla;
- compactar controles manteniendo visibles los filtros activos;
- transformar detail persistente en acceso explícito cuando sea necesario;
- conservar acciones críticas y targets táctiles adecuados en el handoff;
- evitar scroll horizontal para lectura general;
- permitir desplazamiento tabular solo si la estructura lo exige y existe una alternativa usable;
- no convertir hover en requisito.

Una vista operativa móvil puede requerir un subconjunto orientado a guardia o triage. Declarar la tarea preservada y el acceso al resto; no describir la pérdida como simple adaptación visual.

## Zoom, reflow y legibilidad

Especificar que el contenido debe seguir siendo comprensible con ampliación y reflow. Revisar:

- truncamiento de labels o valores;
- superposición de controles;
- pérdida de unidad o contexto;
- orden de lectura después del reflow;
- acciones que quedan fuera de alcance;
- tablas o gráficos sin alternativa.

## Límites de evidencia en Review mode

Una captura estática permite revisar jerarquía visible, grouping, labels, contraste aparente y densidad. No permite confirmar por sí sola:

- keyboard operation;
- focus order;
- announcements;
- estados dinámicos;
- responsive behavior en otros tamaños;
- alternativas textuales internas;
- comportamiento real de filtros y drill-down.

Marcar estas áreas como no verificadas y pedir evidencia adicional solo si puede cambiar materialmente la recomendación. No declarar conformidad o incumplimiento formal sin prueba adecuada.

## Handoff a implementación

Entregar requisitos verificables como:

- orden de lectura y foco esperado;
- interacciones que requieren equivalente de teclado o touch;
- información que no puede depender solo de color;
- equivalente textual o tabular necesario;
- feedback dinámico que debe anunciarse;
- prioridades que deben persistir por tamaño;
- contenido que puede moverse a detail y acceso requerido;
- limitaciones y pruebas todavía necesarias.

No entregar código, tokens, valores de breakpoint ni afirmar compatibilidad técnica no comprobada.

## Checklist de revisión

- La jerarquía visual y el reading order cuentan la misma historia.
- Foco y keyboard behavior están definidos o marcados como no verificados.
- Labels, unidades, período, comparación y estado son recuperables.
- Color, hover, pointer y gestos no son el único acceso a información.
- La información compleja tiene un equivalente que soporta la tarea.
- Responsive preserva señales, contexto y acciones críticas.
- Filtros activos siguen visibles cuando sus controles se compactan.
- Los cambios dinámicos tienen feedback proporcional.
- La revisión no afirma conformidad formal sin evidencia.
