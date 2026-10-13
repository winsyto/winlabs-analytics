# Modos y jerarquía de información

Usar esta referencia al elegir o revisar modo, prioridad, agrupación, overview/detail o densidad. Los modos son perfiles de decisión, no templates visuales.

## Elegir un modo dominante

| Modo | Trabajo principal | Priorizar | Riesgo frecuente |
| --- | --- | --- | --- |
| Executive | Comprender situación y decidir dirección | Outcomes, variaciones materiales, riesgos y decisiones | KPI wall o detalle operativo excesivo |
| Operational | Priorizar y ejecutar trabajo repetido | Excepciones, estado, owner, próxima acción y filtros frecuentes | Ocultar información necesaria para reducir densidad |
| Monitoring | Detectar cambios, salud o riesgo | Estado, tendencia, alertas, thresholds acordados y freshness | Mostrar señales sin relevancia ni camino a diagnóstico |
| Diagnostic | Explicar por qué cambió algo | Comparaciones, drivers, segmentos, composición y evidencia | Profundización sin hipótesis ni retorno |
| Exploratory | Formular y contrastar preguntas | Controles flexibles, múltiples perspectivas, historial y reset | Superficie sin orientación ni defaults útiles |
| Hybrid | Combinar tareas compatibles | Un modo dominante y responsabilidades separadas por zona o vista | Usar la etiqueta para justificar que todo aparezca junto |

No imponer la taxonomía si el caso es simple. Cuando dos tareas difieren en audiencia, cadence, nivel de detalle o acción, evaluar vistas separadas antes de combinarlas.

## Traducir decisiones a prioridad

Asignar prominencia por una o más razones explícitas:

- proximidad a la decisión principal;
- urgencia o coste de omisión;
- materialidad del cambio;
- rol como outcome o guardrail crítico;
- frecuencia de consulta o acción;
- necesidad de comparación inmediata;
- confianza suficiente para actuar.

No priorizar por popularidad, disponibilidad, tamaño del número, simetría o facilidad para convertirlo en card.

Clasificar el contenido:

- **Primary:** orienta o habilita la decisión principal.
- **Context:** explica, compara o confirma una señal primaria.
- **Detail:** responde preguntas diagnósticas o muestra evidencia bajo demanda.
- **Trust metadata:** define alcance, unidad, freshness, calidad, permisos o limitaciones.

El rol analítico no determina por sí solo el nivel visual. Un guardrail poco frecuente puede ser primario si omitirlo produce daño; un outcome estable puede ocupar menos espacio si solo confirma contexto.

## Construir la arquitectura de información

Una estructura completa debe poder expresar estas responsabilidades, sin forzar una página vertical:

1. **Orientation:** propósito, alcance, período, filtros activos y freshness.
2. **Primary signals:** resultados, excepciones o riesgos que requieren atención.
3. **Context:** comparación, drivers o explicación necesaria para interpretar lo primario.
4. **Action and navigation:** siguiente acción y entrada al detalle.
5. **Detail:** entidades, tablas, definiciones o diagnóstico bajo demanda.
6. **Trust:** cobertura, parcialidad, permisos, supuestos y gaps.

Agrupar por pregunta, workflow, entidad o decisión compartida. Evitar grupos basados únicamente en tipo de componente, fuente de datos o conveniencia técnica.

Mantener cerca:

- valor, unidad y comparison anchor;
- señal y guardrail que limita su lectura;
- excepción y acción correspondiente;
- filtro activo y contenido afectado;
- dato y freshness relevante.

## Overview y detail

El overview debe responder rápidamente:

- ¿qué alcance estoy viendo?;
- ¿qué está pasando?;
- ¿contra qué se evalúa?;
- ¿qué requiere atención?;
- ¿dónde puedo profundizar o actuar?

El detail debe responder una pregunta planteada por el overview. Preservar identidad, filtros, comparación, punto de origen y camino de regreso. Si el detalle introduce otra audiencia, otra cadence o un workflow completo, preferir otra vista enlazada.

No esconder en detail una señal crítica solo porque se consulta con poca frecuencia.

## Densidad y scanability

Favorecer mayor densidad cuando la audiencia es experta, usa la vista con frecuencia, compara varias excepciones, necesita acciones repetidas o pagaría un coste alto al abrir detalle continuamente.

Favorecer menor densidad cuando la revisión es ocasional, existen pocas decisiones de alto impacto, el objetivo es síntesis o el contexto reduce la atención disponible.

En ambos casos comprobar:

- agrupación y alineación consistentes;
- labels y unidades recuperables;
- señal de excepción distinguible sin depender solo de color;
- suficiente separación entre zonas con propósitos distintos;
- ausencia de decoración que compita con información;
- coste real de acceder a contenido oculto.

Densidad no equivale a cantidad total. Una tabla compacta puede ser más clara que muchas cards; una pantalla con pocos elementos puede ser confusa si carece de jerarquía.

## Auditar sobrecarga

Antes de eliminar contenido, inventariar para cada elemento:

- decisión, acción o pregunta que soporta;
- audiencia y frecuencia de uso;
- rol como señal, contexto, detail o trust metadata;
- relación o duplicación con otros elementos;
- coste y riesgo de ocultarlo;
- evidencia disponible sobre su uso.

Aplicar después una de estas operaciones:

- **Keep and emphasize:** necesario para orientación o acción principal.
- **Keep and group:** útil, pero compite por falta de estructura.
- **Move to detail:** diagnóstico legítimo que no debe dominar el overview.
- **Merge:** expresa el mismo fenómeno o pregunta de forma redundante.
- **Remove provisionally:** no soporta una decisión y su valor no puede justificarse.
- **Validate:** falta evidencia para decidir sin riesgo.

### KPI wall

Corregir la igualdad de prominencia. No reemplazarla por un máximo universal de KPIs; crear niveles según decisiones y riesgos.

### Card soup

No usar el contenedor como sustituto de jerarquía. Agrupar elementos relacionados y permitir otros patrones —tabla, lista, texto o detalle— cuando representen mejor la tarea.

### Forced symmetry

No igualar tamaños, cantidades o posiciones si la importancia es desigual. El espacio libre no obliga a agregar contenido.

## Checklist de revisión

- El modo corresponde al ritmo y trabajo real de la audiencia.
- Cada sección tiene una pregunta o responsabilidad distinguible.
- La prominencia se justifica por decisión, urgencia o riesgo.
- Overview y detail están conectados pero no compiten.
- Los guardrails críticos siguen visibles o inequívocamente accesibles.
- La densidad reduce tiempo y error en lugar de ocultar o acumular.
- La reducción no se basa en gustos ni en números universales.
- Los elementos ya efectivos se conservan explícitamente.
