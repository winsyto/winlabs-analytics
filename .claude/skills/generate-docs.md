# SKILL: GENERATE_DOCS

**Trigger:** cuando Winsy diga "documentar este módulo", "cerrar funcionalidad" o "generar docs".

**Referencia completa:** `proyecto/10-estandares-y-skills.md` §7.

---

## Estructura obligatoria del documento

Crear en `/docs/modules/<modulo>.md`:

```markdown
# <Título del módulo>

**Fecha:** YYYY-MM-DD
**Estado:** Borrador | MVP | Final

## Resumen
<1 párrafo: qué hace, para quién, qué problema resuelve>

## Arquitectura

### Tablas involucradas
- `<tabla>`: <rol>

### Archivos clave
- Server Actions: `apps/<app>/app/(dashboard)/<feature>/_actions/`
- Componentes: `apps/<app>/app/(dashboard)/<feature>/_components/`
- Queries: `packages/db/queries/<feature>.ts` (si existe)

### Diagrama (Mermaid, si aplica)
\`\`\`mermaid
sequenceDiagram
  ...
\`\`\`

## Decisiones técnicas relevantes
- Por qué se eligió X sobre Y

## Cómo extender
<Pasos para agregar una variante o caso nuevo>

## Pendientes
- [ ] ...

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-XX-XX | Versión inicial |
```

## Reglas

- Documentar el "por qué" y los "qué", no el "cómo línea por línea"
- Sin redundancia con el código
- Actualizar changelog en cada cambio significativo

## Dónde vive cada doc

| Carpeta | Contenido |
|---|---|
| `/docs/modules/` | Un .md por módulo funcional |
| `/docs/architecture/` | Decisiones globales (auth, multi-tenant, IA) |
| `/docs/database/` | DBML + changelog de schema |
| `/docs/runbooks/` | Procedimientos operativos paso a paso |
