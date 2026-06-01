# SKILL: ADD_CRUD

**Trigger:** cuando se deba implementar un CRUD completo para una entidad.

**Referencia completa:** `proyecto/10-estandares-y-skills.md` §6.

---

## Estructura de archivos a crear

```
apps/<app>/app/(dashboard)/<entidad>/
  page.tsx                          ← Server Component: fetch + render tabla
  [id]/
    page.tsx                        ← Detalle (opcional)
  _actions/
    <entidad>.actions.ts            ← "use server": Zod + assertCan + withTenantContext + revalidatePath
  _components/
    <entidad>-table.tsx             ← Tabla con sorting/filtering server-side
    create-<entidad>-dialog.tsx     ← Dialog de creación ("use client")
    edit-<entidad>-dialog.tsx       ← Dialog de edición ("use client")
    delete-<entidad>-dialog.tsx     ← Confirmación de borrado
```

## UI estándar (enterprise B2B)

### PageHeader (en page.tsx)
- Izquierda: ícono + título + subtítulo
- Derecha (en orden): Exportar dropdown (Excel + PDF) → Herramientas (outline) → + Crear

### Tabla
- Server-side pagination + filtering + sorting via Search Params en URL
- Columna de acciones: dropdown con Editar / Ver / Eliminar
- Empty state cuando no hay datos

### Formularios
- Siempre en `<Dialog>` (modal) — NO usar Sheet
- react-hook-form + Zod resolver
- Campos con Label + Input + error message inline

## Server actions — patrón obligatorio

```ts
"use server";
import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { assertCan } from "@wla/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createSchema = z.object({ ... });

export async function createEntityAction(_prev: State, formData: FormData): Promise<State> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  // Obtener rol actual desde BD (no desde JWT)
  const role = await getCurrentUserRole(session.user.tenantId, session.user.id);
  assertCan(role, "create", "resource"); // lanza ForbiddenError si no puede

  try {
    await withTenantContext(session.user.tenantId, (tx) =>
      tx.entity.create({ data: { tenantId: session.user.tenantId, ...parsed.data } })
    );
    revalidatePath("/entity");
    return { success: true };
  } catch (err) {
    console.error("[createEntityAction]", err);
    return { error: "Error al crear. Intentá de nuevo." };
  }
}
```

## Checklist

- [ ] DBML + Prisma actualizados (si es tabla nueva, correr ADD_TABLE primero)
- [ ] Server actions con Zod + assertCan + withTenantContext + revalidatePath
- [ ] Página con PageHeader estándar (Exportar + Herramientas + Crear)
- [ ] Tabla server-side con sorting/filtering en URL
- [ ] Dialogs para crear y editar (no Sheet)
- [ ] Dialog de confirmación para eliminar
- [ ] Empty state
- [ ] typecheck verde: `pnpm --filter @wla/<app> typecheck`
