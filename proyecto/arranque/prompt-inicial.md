# Prompt inicial para la nueva sesión

> Copiá el bloque de abajo y pegalo como **primer mensaje** en la sesión nueva (Opus 4.6, workspace montado en `D:\Win-Devs\winlabs-analytics\`).

---

## 📋 Prompt para pegar

```text
Hola. Estoy arrancando el desarrollo de WinLabs Analytics (alias wl-Analytics / wlA). El diseño ya está cerrado y vive completo en `proyecto/`. Tu rol es asistirme en la implementación.

Antes de proponer nada, leé en este orden:
1. `proyecto/README.md` — mapa general del diseño y resumen ejecutivo.
2. `proyecto/DECISIONS.md` — todas las decisiones cerradas (D-001 a D-105) y las 16 abiertas.
3. `proyecto/09-setup-inicial.md` — checklist concreto del setup que vamos a ejecutar primero.
4. `proyecto/10-estandares-y-skills.md` — convenciones de BD, layout, CRUDs y los skills que vas a usar.
5. `proyecto/arranque/CLAUDE.md` — versión lista del CLAUDE.md para copiar a la raíz del repo.

Después de leer:

1. Confirmame en un mensaje breve (máx 10 líneas) que entendiste:
   - El producto (qué es, para quién, fase actual).
   - Las decisiones técnicas core (Next.js full-stack + Prisma + Postgres+RLS + Vercel + Trigger.dev + Llama).
   - Las 3 decisiones abiertas críticas que bloquean el arranque (Open-3 subdomain vs path-based, Open-6 acceso APIs Manú/Geovictoria, Open-16 T0 efectivo).

2. Preguntame: ¿arrancamos el Paso 1 del setup (crear repo y monorepo) o querés cerrar primero alguna decisión abierta?

Reglas de trabajo (no negociables):

- Trabajamos por etapas: definir objetivo → definir archivos → implementar → validar → documentar lo mínimo necesario → continuar.
- Evitar: refactors grandes sin necesidad, abstracciones prematuras, duplicación obvia, dependencias innecesarias, lógica de dominio mezclada con UI, endpoints API cuando Server Actions alcanzan.
- Operaciones de Git las hago yo manualmente. Vos solo sugerís cuándo es buen momento para commitear.
- Antes de instalar una librería nueva, justificá por qué.
- Aplicá los skills documentados en `proyecto/10-estandares-y-skills.md` cuando corresponda (SKILL 6, 7, 9, 10, 11).
- Cuando tengas que crear/modificar tablas, SIEMPRE empezás por DBML en `/docs/database/wla_schema.dbml` y después Prisma. Nunca al revés.
- Toda Server Action de mutación tiene que tener su Tool Definition en `packages/ai/tools.ts` (SKILL 9).

Ya cuando arranquemos, ayudame a copiar `proyecto/arranque/CLAUDE.md` a la raíz del repo y los skills de `proyecto/arranque/skills/` a `.claude/skills/`.

Arrancá leyendo los 5 archivos y luego dame tu confirmación de contexto + la pregunta del punto 2.
```

---

## Notas sobre el prompt

- **Le pido que lea los 5 docs en orden específico**: README → DECISIONS → setup → estándares → CLAUDE.md preparado. Así carga contexto en el orden lógico.
- **Le pido confirmación corta** (máx 10 líneas) para validar que entendió antes de invertir tokens en código.
- **Las 3 decisiones abiertas críticas** son las que efectivamente bloquean el arranque. Las otras 13 se cierran en su momento.
- **Las reglas de trabajo** están alineadas con el §8 del documento 10 (criterios de implementación + anti-patterns).
- **Git manual** está explícito desde el prompt para evitar que el agente intente commitear solo.

## Variante más corta (si querés algo más conciso)

Si preferís un prompt más breve:

```text
Estoy arrancando la implementación de WinLabs Analytics. Todo el diseño vive en `proyecto/`.

Leé en este orden: `proyecto/README.md`, `proyecto/DECISIONS.md`, `proyecto/09-setup-inicial.md`, `proyecto/10-estandares-y-skills.md` y `proyecto/arranque/CLAUDE.md`.

Confirmame brevemente que entendiste y proponeme el primer paso del setup.

Reglas: trabajamos por etapas (objetivo / archivos / implementar / validar / documentar / continuar). Git lo manejo yo manualmente. Aplicá los skills de `proyecto/10-estandares-y-skills.md` cuando corresponda.
```
