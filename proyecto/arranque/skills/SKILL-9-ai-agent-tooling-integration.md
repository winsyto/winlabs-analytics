---
name: ai-agent-tooling-integration
description: Cada Server Action de mutación o query compleja en wlA debe registrarse como tool del agente LLM user-facing. "Si lo hace un humano, lo hace el agente."
---

# SKILL 9 — AI_AGENT_TOOLING_INTEGRATION

## Trigger

- Cuando se cree o modifique una **Server Action de mutación** (create/update/delete).
- Cuando se cree una **query compleja** que el agente del usuario podría necesitar invocar.
- Cuando se cree un **nuevo módulo CRUD completo** (registrar create + getAll + getById + update + delete).

## Objetivo

Asegurar que cada capacidad del backend sea **descubrible** por el agente LLM user-facing de wlA. Cada acción que un humano ejecuta desde la UI debe poder ejecutarse vía lenguaje natural en el chat.

## Regla de Oro

> **"Si lo hace un humano, lo hace el agente."**

Toda Server Action DEBE tener su Tool Definition correspondiente en `packages/ai/tools.ts`. **Sin excepciones.**

## Pasos de ejecución obligatorios

### Paso 1 — Agregar el bloque `// @ai-tool` en la Server Action

Al inicio del archivo (o de la función específica si el archivo tiene múltiples tools):

```typescript
// @ai-tool
// name: "create_integration"
// displayName: "Crear Integración"
// description: "Crea una nueva configuración de integración para el tenant activo. Úsala cuando el usuario diga 'agregar integración', 'conectar X', 'configurar fuente de datos'."
// category: "config"
// type: "mutation"
// requiredPermission: { resource: "integrations", action: "create" }
// uiResponse: "SUCCESS_CARD"
```

### Paso 2 — Registrar la tool en `packages/ai/tools.ts`

- Importar el tipo `AiToolDefinition` de `@/packages/ai/tool-types`.
- Agregar entrada al array `AI_TOOLS` con la estructura tipada.
- Los `parameters` deben coincidir EXACTAMENTE con el schema Zod de validación de la acción.
- Asignar `uiResponse` correcto según la tabla del Paso 4.

### Paso 3 — Seguridad (CRÍTICO — no negociable)

- ⛔ **PROHIBIDO** que el agente reciba o pase `tenantId`, `userId`, `clientId` como parámetros de la tool. Estos se obtienen siempre desde `getSession()` en el backend.
- ✅ **OBLIGATORIO**: `requiredPermission` debe reflejar EXACTAMENTE el `resource+action` que `checkAuth()` valida en la acción real.
- La tool NUNCA expone datos fuera del scope del tenant activo (RLS implícita por arquitectura).
- Tools de tipo `mutation` con efectos destructivos requieren confirmación del usuario antes de ejecutarse.

### Paso 4 — Categorías válidas y `uiResponse` esperado

| Categoría | Descripción | uiResponse recomendado |
|---|---|---|
| `config` | CRUDs de configuración (catálogos, reglas, integraciones) | `SUCCESS_CARD` / `DATA_TABLE` |
| `dashboards` | Acciones sobre dashboards (configurar, abrir, filtrar) | `WIDGET_DASHBOARD` / `NAVIGATION_CARD` |
| `integrations` | Activar/desactivar/correr integraciones, ver runs | `SUCCESS_CARD` / `DATA_TABLE` |
| `people` | Consultas sobre empleados (read-only en MVP) | `DATA_TABLE` / `EMPLOYEE_CARD` |
| `security` | Roles, permisos, usuarios | `SUCCESS_CARD` |
| `navigation` | Buscar y navegar a secciones de la app | `NAVIGATION_CARD` |
| `ai` | Configurar LLM provider por tenant, ver costos | `SUCCESS_CARD` |

### Paso 5 — Tools de lectura asociadas

Cuando un CRUD genera un módulo completo, registrar también las **queries** (`getAll`, `getById`) como tools para que el agente pueda **leer antes de mutar**.

## Ejemplo completo de Tool Definition

```typescript
{
  name: "create_integration",
  displayName: "Crear Integración",
  description: "Crea una nueva configuración de integración para el tenant activo. Úsala cuando el usuario diga 'agregar integración', 'conectar Manú', 'conectar Geovictoria' o similar.",
  category: "config",
  type: "mutation",
  requiredPermission: { resource: "integrations", action: "create" },
  actionFile: "apps/cliente/server-actions/integrations.ts",
  functionName: "createTenantIntegration",
  parameters: {
    type: "object",
    properties: {
      templateId:  { type: "number", description: "ID del template de integración del catálogo" },
      name:        { type: "string", description: "Nombre amigable para identificar esta integración" },
      cronSchedule: { type: "string", description: "Expresión cron (opcional, solo para scheduled)" },
      config:      { type: "object", description: "Configuración específica (mapping, filtros, etc.)" }
    },
    required: ["templateId", "name"]
  },
  uiResponse: "SUCCESS_CARD"
}
```

## Errores frecuentes a evitar

- ⛔ Usar `name` como label de UI. `name` es el identificador técnico (snake_case) para el LLM. `displayName` es lo que ve el usuario.
- ⛔ Agregar parámetros que el backend resuelve solo (`tenantId`, `userId`, `clientId`).
- ⛔ Olvidar actualizar `tools.ts` cuando cambia el schema Zod de una acción existente. Las definiciones DEBEN estar siempre sincronizadas.
- ⛔ Registrar una tool sin `requiredPermission` o con un resource/action que no existe en `sec_permissions`.
- ⛔ Devolver datos cross-tenant en una tool (siempre RLS via `withTenantContext`).

## Anti-alucinación y safety

- El agente SOLO puede ejecutar tools registradas en `tools.ts`. NO improvisa SQL ni accede a datos directos.
- Si la tool pide parámetros que el agente no tiene claros, el chat **repregunta** antes de ejecutar.
- Mutations destructivas (`delete`, `cancel`, `reset`) SIEMPRE con confirmación explícita del usuario.
- Todas las invocaciones quedan auditadas en `sec_audit_log` con `actor_type = 'agent'` y `ai_session_id` en el context.

## Procedimiento al crear/modificar una Server Action

1. Aplicar el resto del workflow (Zod, permisos, audit).
2. Agregar `// @ai-tool` block al inicio.
3. Editar `packages/ai/tools.ts`: importar y agregar la entrada.
4. Verificar que los `parameters` matcheen el Zod schema.
5. Verificar que `requiredPermission.resource` + `action` existan en `sec_permissions`.
6. Probar mentalmente: "¿Si el agente recibe `tenantId` desde el usuario, qué pasa?". Si la respuesta NO es "ese parámetro no existe, se obtiene del backend" → corregir.
7. Sugerir commit: `feat(<modulo>): add <action> + register AI tool`.

## Ver también

- `proyecto/10-estandares-y-skills.md` §9
- `add-crud.md` para el workflow completo de un CRUD nuevo con sus tools asociadas
