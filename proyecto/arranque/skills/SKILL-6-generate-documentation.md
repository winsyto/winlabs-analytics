---
name: generate-documentation
description: Generar documentación de módulos o decisiones arquitectónicas en wlA. Estructura obligatoria, Markdown + Mermaid si aplica.
---

# SKILL 6 — GENERATE_DOCUMENTATION

## Trigger

Se activa cuando Winsy diga:

- "Documentar este módulo"
- "Cerrar funcionalidad"
- "Generar docs"
- "Documentar X"

## Acción

Generar contenido para un archivo `.md` en:

- `/docs/modules/<modulo>.md` — para documentar un módulo funcional (p.ej. `hr-people.md`, `absenteeism.md`, `integration-manu.md`).
- `/docs/architecture/<tema>.md` — para documentar decisiones globales (p.ej. `multi-tenancy.md`, `ai-layer.md`).

## Estructura obligatoria

```markdown
# <Título del módulo>

**Fecha:** YYYY-MM-DD
**Estado:** Borrador | MVP | Final
**Owner técnico:** <nombre>

## Resumen

<1 párrafo: qué hace este módulo, para quién, qué problema resuelve.>

## Arquitectura

### Tablas involucradas
- `<prefijo>_<tabla>`: <rol breve>
- ...

### Archivos clave
- **Server Actions**: `apps/<app>/server-actions/<archivo>.ts`
- **Componentes UI**: `apps/<app>/.../<componente>.tsx`
- **Queries de BD**: `packages/db/queries/<archivo>.ts`
- **Tipos**: `packages/types/<archivo>.ts`
- **Tools del agente** (si aplica): registrados en `packages/ai/tools.ts`

### Diagrama (Mermaid, si aplica)

\`\`\`mermaid
sequenceDiagram
  Usuario->>UI: dispara acción
  UI->>ServerAction: invoca
  ServerAction->>DB: query/mutation
  DB-->>ServerAction: rows
  ServerAction-->>UI: { ok, data }
\`\`\`

## Decisiones (ADR)

### ADR-XXX: <Título de la decisión>
- **Contexto**: ...
- **Decisión**: ...
- **Alternativas descartadas**: ...
- **Consecuencias**: ...

## Flujo / Uso

<Cómo se usa el módulo desde la perspectiva del usuario final + cómo se extiende o mantiene desde la perspectiva técnica.>

## Cómo extender

<Pasos concretos para agregar una variante / un caso nuevo sobre este módulo.>

## Pendientes / decisiones abiertas

- [ ] ...

## Changelog

| Fecha | Cambio | PR |
|---|---|---|
| 2026-MM-DD | Versión inicial | #123 |
```

## Reglas

- **Markdown estándar**. Si aplica, incluir Mermaid para diagramas (preferido sobre Word/figma para versionar).
- **Sin redundancia con el código**: documentar el "por qué" y los "qué", no el "cómo línea por línea".
- **Actualizar el changelog** en cada cambio significativo del módulo.
- **ADRs cortos**: si la decisión es trivial, una sola línea en una tabla. Si es estructural, ADR completo con alternativas y consecuencias.
- **Vincular**: a otros docs relevantes (`/docs/modules/...`, `/proyecto/...`, ADRs).
- **Borrador → MVP → Final**: actualizar el estado a medida que el módulo madura.

## Dónde vive cada tipo de doc

| Carpeta | Contenido |
|---|---|
| `/proyecto/` | Documentación de producto y diseño macro (NO se modifica acá durante implementación). |
| `/docs/modules/` | Una entrada por módulo funcional (people, absenteeism, time, payroll, integraciones, etc.). |
| `/docs/architecture/` | Decisiones globales (multi-tenant, auth, IA, observabilidad). |
| `/docs/database/` | Diccionario DBML + changelog de schema. |
| `/docs/runbooks/` | Procedimientos operativos paso a paso. |
| `/docs/adr/` | Architecture Decision Records cortos con frontmatter. |

## Procedimiento

1. Identificar **dónde vive** (modules vs architecture vs runbook).
2. Identificar si **ya existe** un doc para ese módulo:
   - Si sí: actualizarlo (agregar al Changelog, ajustar secciones).
   - Si no: crear nuevo con la estructura obligatoria.
3. Llenar las secciones desde el código real:
   - Listar las tablas (`grep` por el prefijo del módulo en `prisma/schema.prisma`).
   - Listar los archivos clave (server actions, componentes, queries).
4. Agregar Mermaid si hay flujos no obvios.
5. Si hubo decisiones técnicas durante la implementación, documentarlas como ADR (acá o en `/docs/adr/` si son grandes).
6. Sugerir commit: `docs(modules): document <modulo>` o `docs(architecture): document <tema>`.

## Errores frecuentes a evitar

- ⛔ Documentar línea por línea el código (eso lo lee el lector mirando el código).
- ⛔ Omitir el bloque "Decisiones (ADR)" — ahí vive el conocimiento que no está en el código.
- ⛔ No actualizar el Changelog cuando se cambia algo del módulo.
- ⛔ Mezclar docs de producto (que viven en `proyecto/`) con docs operativas (que viven en `docs/`).

## Ver también

- `proyecto/10-estandares-y-skills.md` §7
- Plantillas de ADR en `/docs/adr/_template.md` (crear cuando aparezca el primer ADR)
