# Hub de dashboards (M3.5, bloque 2)

**Fecha:** 2026-10-28
**Estado:** MVP (catálogo, activación por tenant, guardia de acceso y administración en el CMP; el hub visual del cliente va en el bloque 3)

## Resumen

Define **qué dashboards ve cada empresa**. Un catálogo global lista los dashboards y los módulos de datos que requiere cada uno; cada tenant tiene los suyos activos o apagados, administrado desde el CMP. Un dashboard apagado desaparece del menú del cliente y, aunque se llegue por la URL, responde "Dashboard no habilitado". Está preparado para permisos por rol, pero en esta versión solo hay activación por tenant.

## Arquitectura

### Tablas
- `cfg_dashboards` (sin RLS, catálogo global): `code` (PK), nombre, descripción, ruta, `required_modules` (`people`, `time`, `payroll`), orden y `is_active`. Lo cargan la migración (para que el deploy no dependa de un seed manual) y `upsertDashboardCatalog` (seed de catálogo y de desarrollo).
- `dsh_tenant_dashboards` (RLS por tenant): tenant, `dashboard_code`, `is_enabled` y `allowed_roles` (preparada para permisos por opción de menú, hoy no se usa: lo ven todos los roles).
- `tenants.active_modules`: los módulos de datos activos del tenant (ya existía). Un dashboard solo se puede activar si el tenant tiene los módulos que requiere.
- `dsh_dimensions`: las dimensiones de cada dashboard se conservan aunque el dashboard se apague; la tarjeta de dimensiones del tenant solo lista los activos.

| Dashboard | Requiere |
|---|---|
| Headcount, Rotación | Personas |
| Ausentismos, Horas extras | Personas + Asistencia |
| Payroll | Personas + Liquidaciones |

### Reglas
- **Tenants existentes:** la migración les activa todos los dashboards (nada cambia hasta que alguien apague uno).
- **Tenant nuevo:** se activan automáticamente los dashboards cuyos módulos están activos (`applyDefaultDashboards`).
- **Activar sin módulo requerido:** no se puede (el interruptor queda deshabilitado y explica qué módulo falta). Un dashboard ya activo siempre se puede apagar.
- **Desactivar un módulo de datos** apaga los dashboards que dejan de cumplir sus requisitos. Activar un módulo no enciende nada solo.
- **Auditoría:** cada cambio (y los apagados automáticos) queda en `audit_log` (`dashboard.enabled` / `dashboard.disabled`, con el usuario interno en `metadata`).

### Archivos clave
| Qué | Dónde |
|---|---|
| Catálogo, módulos y reglas | `packages/db/src/dashboards-config.ts` (`DASHBOARD_CATALOG`, `missingModules`, `applyDefaultDashboards`, `upsertDashboardCatalog`) |
| Migración | `packages/db/prisma/migrations/20261023000000_add_dashboards_hub/` |
| CMP: página y acción | `apps/cmp/app/(dashboard)/dashboards/` (`page.tsx`, `_actions/dashboards.actions.ts`, `_components/dashboard-toggle.tsx`) |
| CMP: tarjeta del tenant | `apps/cmp/app/(dashboard)/tenants/[tenantId]/_components/tenant-dashboards-card.tsx` |
| Cliente: guardia y menú | `apps/cliente/app/(dashboard)/_dashboard-kit/dashboard-access.tsx` (`enabledDashboards`, `isDashboardEnabled`, `DashboardGuard`), un `layout.tsx` en cada dashboard, la comprobación en cada ruta `export/route.ts` y el filtro de `_components/app-sidebar.tsx` |

## Pantallas

- **CMP > Dashboards:** matriz de tenants × dashboards con interruptores, **búsqueda** por nombre o slug y **paginación de 12 filas** (el tamaño que entra de un vistazo en una pantalla de 15,6" sin scroll; es el estándar para las grillas de la etapa). Cada columna indica los módulos que requiere.
- **CMP > detalle del tenant:** tarjeta "Dashboards" con los mismos interruptores.
- **Cliente:** el menú muestra solo los dashboards activos; un dashboard apagado muestra "Dashboard no habilitado" y su exportación responde 403.

## Pendientes
- [ ] Hub visual de dashboards en el cliente (bloque 3) en lugar de un ítem de menú por dashboard.
- [ ] Permisos por rol por dashboard (la columna `allowed_roles` ya existe) y su interfaz.
- [ ] Orden personalizado de los dashboards por tenant, si se pide.

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-28 | Versión inicial: catálogo, activación por tenant, guardia, matriz en el CMP y menú filtrado |
