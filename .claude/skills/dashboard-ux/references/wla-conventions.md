# Convenciones de WinLabs Analytics

Usar esta referencia al diseñar o revisar cualquier dashboard de este proyecto. Resume decisiones ya tomadas con el cliente y validadas en el primer dashboard (Headcount); no las reabras sin una razón nueva. Los detalles de implementación están en `.claude/skills/add-dashboard.md` y en `docs/modules/dashboard-headcount.md`.

## Contexto de uso

- Audiencia: personas de RRHH y People Analytics de empresas de LATAM. Hoy todos los roles del tenant ven los mismos dashboards.
- Pantalla de referencia: notebook de 15.6" (unos 1536×730 útiles). Lo jerárquico entra en esa pantalla **sin scroll**; el detalle va en otra vista.
- Idioma de la interfaz: español. Números y fechas con formato es-AR.
- Cadence de los datos: mensual (a lo sumo semanal). No ofrecer tiempo real ni refrescos frecuentes.

## Estructura canónica de un dashboard

1. Encabezado: título, período y comparación en lenguaje claro, indicador de frescura y exportar.
2. Filtros: período más las dimensiones configuradas del tenant, siempre visibles; "Limpiar filtros" cuando hay alguno activo.
3. KPIs primarios: cuatro tarjetas como máximo. Cada una lleva valor, comparación contra el período anterior, una referencia secundaria y abre el detalle de personas o registros que la componen.
4. Gráficos: la evolución en el tiempo y la distribución por cada dimensión; cada gráfico con su unidad y su fecha de referencia.
5. Detalle: páginas aparte (drill-down), no modales ni tablas incrustadas.

## Contrato de métricas y comparación

- Períodos estándar: último mes cerrado, últimos 12 meses y año en curso.
- Comparación: contra el período equivalente anterior; referencia secundaria con el promedio de los últimos 12 meses. Si el historial no cubre la comparación, decirlo en vez de mostrar un cero.
- Variaciones en color neutro con flecha, signo y texto. Reservar verde/rojo para cuando exista un benchmark acordado, y aun así acompañarlos de texto o forma.
- Benchmarks (ausentismo, horas extra, rotación): configurables por tenant con un valor por defecto (`cfg_tenant_metric_targets`, editables en Configuración > Metas); se muestran como línea de referencia y como estado en la tarjeta con ícono y texto, sin rojo/verde por sí solos. No inventarlos en pantalla sin ese contrato.
- Una persona o registro cuenta en la unidad que tenía **en la fecha del evento o del cierre**, no en la actual.

## Filtros y navegación

- Las dimensiones salen de la configuración del tenant; el diseño no asume nombres como Área o Sede.
- Selección múltiple: OR dentro de una dimensión, AND entre dimensiones. "Sin asignar" es un valor filtrable.
- El estado completo (período, filtros, orden, página) vive en la URL; cada dashboard tiene su propio estado y no comparten filtros.
- El drill-down son páginas con breadcrumb que conservan los filtros; con paginación, búsqueda y orden. Siempre hay un camino de vuelta.
- Cada número del resumen debe poder abrirse hasta sus componentes.

## Gráficos

- Evolución: línea con el valor visible en cada punto.
- Distribución: dona si hay hasta 4 categorías, barras horizontales ordenadas si hay más; "Sin asignar" no cuenta para elegir.
- Con más dimensiones que paneles posibles, el excedente va en un panel con pestañas.
- Todo gráfico trae un resumen textual y una tabla equivalente para lectores de pantalla; el significado no depende solo del color.

## Estados y frescura

- Mostrar siempre "datos al cierre de <mes>" y el historial disponible.
- Estados obligatorios: carga (esqueleto, y atenuado localizado al cambiar filtros), vacío (con el siguiente paso, por ejemplo cargar un archivo), sin resultados (con "Limpiar filtros"), desactualizado (más de 45 días desde el último cierre), historial con huecos y comparación no disponible.
- Distinguir cero, vacío, sin resultados y error.

## Exportación

- Excel con los datos (hojas separadas por tema) y PDF **paginado y estructurado**; no capturas de pantalla.
- Respetan período y filtros activos y los repiten en el encabezado, con fecha de exportación y de los datos.
- Tienen un tope de filas por listado y avisan cuando se alcanza.

## Responsive y accesibilidad

- Desktop denso; en pantallas chicas todo apila en una columna. Los filtros activos nunca se ocultan.
- Teclado operable (filtros, pestañas, menús), foco visible, etiquetas con unidad y período.
- Sin scroll horizontal salvo en las tablas de detalle.

## Antipatrones ya vistos en este proyecto

- Filtros, paneles o columnas escritos para dimensiones concretas en lugar de recorrer la configuración.
- Comparar o filtrar por el estado actual de una persona cuando la pregunta es sobre un momento pasado.
- Mostrar números sin cobertura ni fecha de cierre.
- Diseñar el dashboard antes de verificar que los datos y su carga existen.

## Gaps abiertos para product-analytics y producto

- Benchmarks y metas por tenant (resuelto con el Dashboard 2; falta usarlos en horas extra y rotación).
- Permisos por dashboard y por opción de menú.
- Hub de dashboards y administración de dashboards activos por tenant (posterior a los dashboards del MVP).
