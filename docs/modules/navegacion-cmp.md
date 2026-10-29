# Navegación del CMP (M3.5, bloques 5a y 5b)

**Fecha:** 2026-10-30
**Estado:** MVP (menú, hubs e Inicio; varias entradas de Configuración son "Próximamente")

## Resumen

El menú de la consola interna tiene cuatro ítems: **Inicio · Tenants · Integraciones · Configuración**. Tenants, Integraciones y Configuración son **hubs** con tarjetas agrupadas (ícono, nombre y descripción); las páginas que ya existían se reutilizan sin cambios y las que todavía no existen muestran "Próximamente".

```
Inicio            /dashboard              Indicadores: tenants activos, usuarios de tenants, integraciones activas (manuales / automáticas)
Tenants           /tenants                Hub (grupo General)
   Tenants        /tenants/list           Lista (búsqueda y 12 por página) y alta; menú de acciones con las secciones de cada tenant
                  /tenants/[id]           Ficha: información, módulos analíticos y dashboards
                  /tenants/[id]/org-units | /attendance | /users | /integrations   Secciones (cada una muestra y edita solo lo suyo)
Integraciones     /integrations           Hub (grupo General)
   Activas        /integrations/active    Integraciones por tenant (búsqueda, filtros por tenant y estado, 12 por página); detalle en /integrations/[id]
Configuración     /settings               Hub
   Básicas        Tipos de unidades organizativas (Próximamente, /settings/org-unit-types)
                  Tipos de ausencia (/settings/absence-types) · Tipos de hora (/settings/time-entry-types)
                  Módulos analíticos (/settings/data-models: módulos de datos activos por tenant)
   Dashboards     Dashboards (/settings/dashboards) · Metas (Próximamente, /settings/targets)
   Integraciones  Templates de integración (/settings/templates)
   Seguridad      Roles · Usuarios · Matriz de permisos (Próximamente, /settings/roles, /users, /permissions)
```

## Detalles
- **Rutas:** las listas pasaron a `/tenants/list` e `/integrations/active` para que `/tenants` e `/integrations` sean los hubs. Las cinco páginas de catálogos (tipos de ausencia, tipos de hora, dashboards, templates y módulos analíticos) pasaron a colgar de `/settings/...` (bloque 5b, D-149); las URLs viejas (`/absence-types`, `/time-entry-types`, `/dashboards`, `/templates`, `/data-models`) redirigen (`redirects()` de `next.config.ts`). "Configuración" queda marcado en el menú por prefijo.
- **Tenants (5b):** la ficha (`/tenants/[id]`) solo muestra y edita Información (el nombre; el slug no se edita porque es parte del login), Módulos analíticos y Dashboards. Unidades organizativas y dimensiones, Asistencia, Usuarios e Integraciones son páginas propias (`TenantSectionHeader` con ruta y salto entre secciones), a las que se llega desde el menú de acciones (⋯) de la lista de tenants o desde la ficha. Los datos de cada sección viven en `tenants/[tenantId]/_data/tenant-config.ts`.
- **Grillas (5b):** búsqueda y paginación de a 12 en tenants, integraciones activas, templates y tipos de ausencia y de hora (componentes `list-controls.tsx`: `SearchForm`, `Pager`, `paginate`). Las altas de tipos se hacen en una ventana. Templates se agrupa por categoría y muestra cuántas integraciones activas usa cada uno.
- **Inicio:** cuenta los tenants activos, los usuarios activos y las integraciones activas (`status = active`) de los tenants activos, separando manuales (template de archivo) de automáticas (API/SFTP, hoy 0). Como las tablas de tenant tienen RLS, usuarios e integraciones se cuentan dentro del contexto de cada tenant.
- **Metas:** los valores base (ausentismo 4 %, horas extra 10 %, rotación 18 % anual) están fijos en `METRIC_TARGET_DEFAULTS` y cada tenant los redefine en su portal; falta un lugar en el CMP para definir los valores base.
- **Usuarios:** la entrada del menú que daba 404 dejó de ser un enlace roto; los usuarios de cada tenant se administran en el detalle del tenant.
- **Componentes:** `HubCard`, `HubGroup` y `ComingSoon` están duplicados en `apps/cmp/app/(dashboard)/_components/` y en el portal del cliente; conviene llevarlos a `@wla/ui` más adelante.

## Pendientes
- [ ] CRUD de Tipos de unidades organizativas, Roles, Usuarios internos y Matriz de permisos del CMP.
- [ ] Valores base de las metas.
- [x] Mover tipos de ausencia y de hora (y las otras tres pantallas de configuración) bajo `/settings` y mejorar su UI (bloque 5b).
- [ ] Login del portal sin escribir el slug del tenant (ver D-149 y `BACKLOG.md`).
- [ ] Llevar los componentes de hub a `@wla/ui`.

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-30 | Versión inicial: menú de cuatro ítems, hubs, Inicio con indicadores y entradas "Próximamente" |
| 2026-10-31 | Bloque 5b: configuración bajo `/settings`, ficha del tenant y secciones como páginas, búsqueda y paginación en las grillas |
