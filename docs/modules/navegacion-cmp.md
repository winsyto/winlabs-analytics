# Navegación del CMP (M3.5, bloque 5a)

**Fecha:** 2026-10-30
**Estado:** MVP (menú, hubs e Inicio; varias entradas de Configuración son "Próximamente")

## Resumen

El menú de la consola interna tiene cuatro ítems: **Inicio · Tenants · Integraciones · Configuración**. Tenants, Integraciones y Configuración son **hubs** con tarjetas agrupadas (ícono, nombre y descripción); las páginas que ya existían se reutilizan sin cambios y las que todavía no existen muestran "Próximamente".

```
Inicio            /dashboard              Indicadores: tenants activos, usuarios de tenants, integraciones activas (manuales / automáticas)
Tenants           /tenants                Hub (grupo General)
   Tenants        /tenants/list           Lista y alta de tenants; detalle en /tenants/[tenantId]
Integraciones     /integrations           Hub (grupo General)
   Activas        /integrations/active    Integraciones por tenant; detalle en /integrations/[id]
Configuración     /settings               Hub
   Básicas        Tipos de unidades organizativas (Próximamente, /settings/org-unit-types)
                  Tipos de ausencia (/absence-types) · Tipos de hora (/time-entry-types)
                  Módulos analíticos (/data-models: módulos de datos activos por tenant)
   Dashboards     Dashboards (/dashboards) · Metas (Próximamente, /settings/targets)
   Integraciones  Templates de integración (/templates)
   Seguridad      Roles · Usuarios · Matriz de permisos (Próximamente, /settings/roles, /users, /permissions)
```

## Detalles
- **Rutas:** las listas pasaron a `/tenants/list` e `/integrations/active` para que `/tenants` e `/integrations` sean los hubs. Los detalles (`/tenants/[id]`, `/integrations/[id]`) y las páginas de catálogos (`/absence-types`, `/time-entry-types`, `/dashboards`, `/templates`, `/data-models`) conservan su URL; "Configuración" queda marcado en el menú mientras se está en cualquiera de ellas (`match` del menú compartido de `@wla/ui`).
- **Inicio:** cuenta los tenants activos, los usuarios activos y las integraciones activas (`status = active`) de los tenants activos, separando manuales (template de archivo) de automáticas (API/SFTP, hoy 0). Como las tablas de tenant tienen RLS, usuarios e integraciones se cuentan dentro del contexto de cada tenant.
- **Metas:** los valores base (ausentismo 4 %, horas extra 10 %, rotación 18 % anual) están fijos en `METRIC_TARGET_DEFAULTS` y cada tenant los redefine en su portal; falta un lugar en el CMP para definir los valores base.
- **Usuarios:** la entrada del menú que daba 404 dejó de ser un enlace roto; los usuarios de cada tenant se administran en el detalle del tenant.
- **Componentes:** `HubCard`, `HubGroup` y `ComingSoon` están duplicados en `apps/cmp/app/(dashboard)/_components/` y en el portal del cliente; conviene llevarlos a `@wla/ui` más adelante.

## Pendientes
- [ ] CRUD de Tipos de unidades organizativas, Roles, Usuarios internos y Matriz de permisos del CMP.
- [ ] Valores base de las metas.
- [ ] Mover tipos de ausencia y de hora bajo `/settings` y mejorar su UI (bloque siguiente de M3.5).
- [ ] Llevar los componentes de hub a `@wla/ui`.

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-30 | Versión inicial: menú de cuatro ítems, hubs, Inicio con indicadores y entradas "Próximamente" |
