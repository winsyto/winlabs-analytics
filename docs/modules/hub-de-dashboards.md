# Hub de dashboards (M3.5, bloque 2)

**Fecha:** 2026-10-28
**Estado:** MVP (catálogo, activación por tenant, guardia de acceso, administración en el CMP y hub visual en el portal del cliente)

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

## Portal del cliente: navegación y hubs (M3.5, bloque 3)

El menú del portal quedó así: **Inicio · Analítica · Data · Reportes · Configuración** (cada uno es un ítem; Data es un hub con Integraciones manuales y Status de integraciones). El menú compartido (`SidebarNav` de `@wla/ui`) ahora admite **secciones** con título (`section`) y rutas asociadas a un ítem (`match`, para que Analítica quede marcada dentro de cualquier dashboard); el CMP lo reutilizará.

| Pantalla | Ruta | Contenido |
|---|---|---|
| Inicio | `/dashboard` | Solo estado de los datos: por cada fuente de archivo, último archivo (fecha, filas y errores), meses con datos y si está al día, desactualizada, con errores, fallida o procesando, con acceso a cargar un archivo |
| Analítica | `/analytics` | Hub de dashboards activos del tenant, agrupados por categoría (RRHH, Finanzas, Otras; los grupos vacíos no se muestran) con tarjetas de ícono, nombre y descripción. Si no hay ninguno habilitado, lo explica |
| Data | `/data` | Hub con Integraciones manuales y Status de integraciones |
| Integraciones manuales | `/integrations` | La carga de archivos de siempre (breadcrumb Data › Integraciones manuales) |
| Status de integraciones | `/integration-status` | Próximamente (integraciones automáticas por API o SFTP) |
| Reportes | `/reports` | Hub de reportes: Próximamente |
| Configuración | `/settings` | Hub agrupado en **Seguridad** (Usuarios) y **Básicas** (Unidades organizativas —próximamente—, Turnos, Tipos de ausencia, Tipos de hora, Conceptos de liquidación y Metas). Solo aparecen las opciones que aplican a los dashboards activos y cada una avisa sus pendientes ("3 sin clasificar", "turnos sin horario", "falta el total bruto") |

Relevancia de las opciones de Configuración: Turnos (Ausentismos u Horas extras), Tipos de ausencia (Ausentismos), Tipos de hora (Horas extras), Conceptos de liquidación (Payroll), Metas (Ausentismos, Horas extras o Rotación); Unidades organizativas y Usuarios, siempre.

Cada dashboard y sus detalles muestran un breadcrumb que empieza en **Analítica** y vuelve al hub. Se quitaron del menú Usuarios (queda en Configuración) y Equipo; Reportes y Status son pantallas "Próximamente". Las URL de los dashboards y de la configuración no cambiaron.

El catálogo (`cfg_dashboards`) tiene ahora `category` e `icon`; Payroll está en RRHH y se puede mover de categoría cambiando una línea de `DASHBOARD_CATALOG`.

## Pendientes
- [ ] Permisos por rol por dashboard (la columna `allowed_roles` ya existe) y su interfaz.
- [ ] Orden personalizado de los dashboards por tenant, si se pide.

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-28 | Versión inicial: catálogo, activación por tenant, guardia, matriz en el CMP y menú filtrado |
| 2026-10-29 | Portal del cliente: menú reorganizado con secciones, hubs de Analítica, Configuración y Reportes, Inicio con el estado de los datos y breadcrumb "Analítica" en los dashboards |
