---
name: add-crud
description: Workflow completo para implementar un CRUD enterprise B2B en wlA — tablas + queries + server actions + UI con template estándar + AI tools + auditoría + docs.
---

# Skill — Add CRUD

## Trigger

Cuando Winsy diga:

- "Crear CRUD de `<entidad>`"
- "Implementar gestión de X"
- "Necesito un CRUD para administrar Y"

## Objetivo

Implementar un CRUD completo de una entidad respetando el **template enterprise B2B** definido en `proyecto/10-estandares-y-skills.md` §6, incluyendo registro de tools del agente (SKILL 9), auditoría automática, exportación XLSX/PDF y documentación.

## Procedimiento (orden estricto)

### Paso 1 — Asegurar que la tabla existe (SKILL 7 / add-table)

Si la tabla no existe todavía, aplicar el skill `add-table` primero. Si existe, continuar.

### Paso 2 — Definir el alcance del CRUD

Confirmar con Winsy:

- ¿Qué columnas se muestran en la **lista**?
- ¿Hay **filtros** específicos además de la búsqueda global?
- ¿Hay **detalle** (vista de solo lectura) o solo lista + edit?
- ¿Hay **soft delete** o hard delete?
- ¿Permisos por defecto correctos (tenant admin = todo; viewer = read)?

### Paso 3 — Queries tipadas en `packages/db/queries/<entidad>.ts`

Funciones requeridas:

- `list<Entity>({ tenantId, page, pageSize, query, sortBy, sortOrder, filters })`
- `count<Entity>({ tenantId, query, filters })`
- `get<Entity>ById(id)`
- `create<Entity>(data)`
- `update<Entity>(id, data)`
- `softDelete<Entity>(id)` (o `delete<Entity>` si es hard delete)

Todas asumen `withTenantContext` ya seteado por el caller.

### Paso 4 — Server Actions en `apps/<app>/server-actions/<entidad>.ts`

Cada acción:

1. Tiene `'use server'` al inicio.
2. Empieza con `// @ai-tool` block (SKILL 9).
3. Valida input con Zod.
4. Llama a `requireSession()` + `assertCan<Entity><Action>()`.
5. Envuelve queries en `withTenantContext`.
6. Llama a `audit()` con before/after.
7. Si toca tablas cacheadas, llama a `revalidateTag(...)` (SKILL 11).
8. Retorna `{ ok: true, data }` o usa `handleActionError(err)`.

Server Actions estándar:

- `list<Entity>Action({ page, pageSize, query, sortBy, sortOrder, filters })`
- `create<Entity>Action(input)`
- `update<Entity>Action(id, input)`
- `delete<Entity>Action(id)`

### Paso 5 — Registrar tools en `packages/ai/tools.ts` (SKILL 9)

Para cada Server Action de mutación + las queries `list` y `getById`, agregar entrada en `AI_TOOLS`.

⛔ **NUNCA** pasar `tenantId` o `userId` como parámetro de tool — siempre vienen del backend.

### Paso 6 — UI: Page Header (template estándar)

En `apps/<app>/app/<ruta>/page.tsx` (o `view-client.tsx`):

⛔ **NO** renderizar `<Breadcrumbs>` en el ViewClient — `MainLayout` ya los inyecta.
⛔ **NO** pasar `menuItems` como prop al ViewClient si era solo para breadcrumbs.

**Izquierda:**
- Ícono del módulo (`bg-primary/10` con icon Lucide adentro).
- Título `text-xl font-semibold`.
- Subtítulo `text-xs text-muted-foreground`.

**Derecha (en este orden):**

1. **Botón Exportar** (OBLIGATORIO y funcional):
   - `<DropdownMenu>` con opciones "Excel (.xlsx)" y "PDF (.pdf)".
   - Crear `lib/export/<entity>-export.ts` con `export<Entity>ToExcel(rows)` y `export<Entity>ToPDF(rows)`.
   - Estado `isExporting` con texto "Exportando..." y `disabled` durante la operación.
   - ⛔ PROHIBIDO dejar el botón sin opciones.

2. **Botón "Herramientas"** (`variant="outline"`):
   - Obligatorio. Si no hay opciones funcionales todavía, `disabled={true}` (no se omite).

3. **Botón principal "+ Crear `<Entidad>`"** (`variant="default"`):
   - Abre el `<Dialog>` de creación.

### Paso 7 — UI: Contenedor de datos (Card / Box)

- **Topbar de tabla**: input de búsqueda global (con ícono lupa) + chips de filtros.
- **DataTable de shadcn** con:
  - Paginación 100% **server-side** (URL: `?page=1&query=texto`).
  - Ordenamiento server-side (`?sortBy=campo&sortOrder=asc|desc`).
  - Helper `SortIcon` (ArrowUp/ArrowDown con `text-primary`; ArrowUpDown opaco en inactivas).
  - **Default ordering** SIEMPRE definido en backend (`orderBy: { id: 'asc' }` si no hay `sortBy` en URL).
- **Columna de acciones**: celda final anclada a la derecha con `<DropdownMenu>` (3 puntos) → Editar / Ver Detalles / Eliminar (con confirmación).

### Paso 8 — UI: Formularios en `<Dialog>`

- Crear / Editar en componente `<Dialog>` modal central de shadcn.
- ⛔ **NO usar `<Sheet>`** para CRUDs estándar.
- React-hook-form + Zod resolver.
- Estados: idle / submitting / success / error.

### Paso 9 — Exportación (XLSX + PDF)

Crear `lib/export/<entity>-export.ts`:

```ts
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";  // o pdfmake / similar

export function export<Entity>ToExcel(rows: <Entity>[]) {
  const ws = XLSX.utils.json_to_sheet(rows.map(toExportRow));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "<Entity>");
  XLSX.writeFile(wb, "<entity>.xlsx");
}

export function export<Entity>ToPDF(rows: <Entity>[]) {
  // implementación con jsPDF / autotable
}
```

### Paso 10 — Permisos (`sec_permissions`)

Agregar en seed `05-sec-permissions.ts` los permisos del módulo:

```ts
{ resource: "<entity_plural>", action: "read" },
{ resource: "<entity_plural>", action: "create" },
{ resource: "<entity_plural>", action: "update" },
{ resource: "<entity_plural>", action: "delete" },
```

Y vincularlos a los roles correspondientes en `06-sec-role-permissions.ts`.

Correr seed: `pnpm db:seed`.

### Paso 11 — Tests

- **Server actions**: integration test con BD local + tenant context (al menos happy path + auth fail).
- **RLS**: ya cubierto por el skill `add-table`.
- **E2E** (Playwright): happy path completo de Crear / Editar / Eliminar.

### Paso 12 — Documentación (SKILL 6)

Crear `/docs/modules/<entidad>.md` con la estructura obligatoria:

- Resumen funcional.
- Arquitectura (tablas + archivos clave).
- ADRs relevantes.
- Flujo de uso (crear, editar, eliminar).
- Cómo extender (agregar campo custom, filtro nuevo, etc.).

### Paso 13 — Sugerir commit

Si todo está unido en un solo cambio:

```
feat(<entidad>): full CRUD with template, AI tools, exports and tests
```

O fraccionado:

```
feat(db): add <entidad> queries
feat(<entidad>): server actions with audit + AI tools
feat(<entidad>): UI list + create/edit dialogs + export dropdown
test(<entidad>): integration + E2E happy path
docs(modules): document <entidad>
```

## Checklist final

- [ ] Tabla existe (DBML + Prisma + RLS).
- [ ] Queries tipadas en `packages/db/queries/`.
- [ ] Server actions con `@ai-tool` + Zod + permisos + audit + revalidate.
- [ ] Tools registradas en `packages/ai/tools.ts` (sin `tenantId`/`userId` como param).
- [ ] Page Header con Exportar (XLSX+PDF funcional), Herramientas, Crear.
- [ ] DataTable server-side con sorting via URL.
- [ ] Forms en Dialog (no Sheet).
- [ ] Acciones por fila con dropdown 3 puntos.
- [ ] Exportación XLSX + PDF funcional desde día 1.
- [ ] Permisos seedeados y asignados a roles.
- [ ] Tests (server action + E2E).
- [ ] Doc en `/docs/modules/<entidad>.md`.
- [ ] Commit sugerido.

## Anti-patterns (no negociable)

- ⛔ Renderizar `<Breadcrumbs>` en el ViewClient (`MainLayout` ya lo hace).
- ⛔ Pasar `menuItems` como prop si era solo para breadcrumbs.
- ⛔ Botón "Exportar" con `disabled` sin opciones.
- ⛔ Paginación / filtrado en cliente (debe ser server-side via URL).
- ⛔ Forms en `<Sheet>` (usar `<Dialog>`).
- ⛔ Server actions sin tools registradas en `tools.ts`.
- ⛔ Pasar `tenantId` o `userId` como parámetro de tool.
- ⛔ CRUD sin auditoría automática.

## Ver también

- `proyecto/10-estandares-y-skills.md` §6 (template CRUD detallado)
- `SKILL-7-cmp-db-modeling.md`
- `SKILL-9-ai-agent-tooling-integration.md`
- `SKILL-10-prisma-seed-and-migrate.md` (para los seeds de permisos)
- `SKILL-11-performance-cache-strategy.md` (si el CRUD afecta catálogos cacheados)
- `SKILL-6-generate-documentation.md` (paso final de docs)
- `add-table.md`
