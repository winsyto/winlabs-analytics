# apps/cmp — Console interna WinLabs

Ver contexto completo en `../../CLAUDE.md`.

## Qué hace esta app

Console de administración interna. Los usuarios son `InternalUser` (tabla separada, sin RLS).
Gestiona: tenants, usuarios de tenants, configuración global.

## Puerto

`localhost:3001`

## Auth

- Provider: Credentials contra tabla `internal_users`
- Sesión: JWT con `user.id`, `user.email`, `user.name`
- **No tiene** `tenantId` en sesión — es una app global, no por tenant
- Archivo: `apps/cmp/auth.ts`
- **Aislamiento frente al portal del cliente (D-146):** cookie de sesión propia (`wla-cmp.session-token`, con `__Secure-` en producción: Auth.js usa su nombre como sal del JWT, así que una sesión del portal no se descifra en el CMP aunque compartan `AUTH_SECRET`), marca `app: "cmp"` en el token (sin ella la sesión no vale) y el layout exige un usuario interno existente y activo. Además, cada app debe tener su **propio `AUTH_SECRET`** en Vercel

## Rutas actuales

```
/login                          → LoginForm (credentials)
/dashboard                      → Inicio: tenants activos, usuarios de tenants e integraciones activas (manuales / automáticas)
/tenants                        → Hub de Tenants (grupo General)
/tenants/list                   → Lista (búsqueda, 12 por página) + crear tenant (roles, admin inicial y configuración de unidades por defecto); el menú ⋯ lleva a la ficha y a las secciones
/settings                       → Hub de Configuración (Básicas, Dashboards, Integraciones y Seguridad)
/settings/org-unit-types, /settings/targets, /settings/roles, /settings/users, /settings/permissions → Próximamente
/tenants/[tenantId]             → Ficha: información (nombre), módulos activos y dashboards
/tenants/[tenantId]/org-units   → Unidades organizativas y dimensiones (Headcount, Ausentismos, Horas extras, Rotación y Payroll)
/tenants/[tenantId]/attendance  → Asistencia (modo, semana laboral y horas por defecto, formato horas/días, base de la tasa de horas extra, moneda de las liquidaciones)
/tenants/[tenantId]/integrations → Integraciones del tenant (alta, pausar, detalle)
/settings/dashboards            → Dashboards por tenant: matriz tenants × dashboards con interruptores, búsqueda y paginación (12 por página); bloquea activar uno sin los módulos de datos que requiere
/settings/absence-types         → Catálogo global de tipos de ausencia por defecto (lo heredan los tenants nuevos); búsqueda, filtro por clase y 12 por página
/settings/time-entry-types      → Catálogo global de tipos de hora por defecto (nombre y categoría; lo heredan los tenants nuevos); búsqueda, filtro por categoría y 12 por página
/tenants/[tenantId]/users       → Usuarios del tenant (crear, resetear contraseña)
/integrations                   → Hub de Integraciones (grupo General)
/integrations/active            → Integraciones de todos los tenants (crear, pausar/activar)
/integrations/[tenantIntegrationId] → Detalle de la integración y sus ejecuciones
/settings/templates             → Templates de integración (activar/inactivar), agrupados por categoría y con las integraciones en uso
/settings/data-models           → Módulos analíticos: módulos de datos activos por tenant en una tabla (también se editan en la ficha del tenant)
```

Las URLs viejas de las pantallas de configuración (`/absence-types`, `/time-entry-types`, `/dashboards`, `/templates`, `/data-models`) redirigen a `/settings/...`.

La configuración de unidades organizativas y dimensiones por dashboard se administra en la sección del tenant (`/tenants/[id]/org-units`) (ver `docs/modules/unidades-organizativas.md`).

Menú: Inicio, Tenants, Integraciones y Configuración (hubs con tarjetas; ver `docs/modules/navegacion-cmp.md`).

## Notas

- El layout del dashboard está en `app/(dashboard)/layout.tsx`
- `app/page.tsx` redirige a `/dashboard`
- `proxy.ts` (no `middleware.ts`) maneja la protección de rutas
- Server actions en `_actions/` dentro de cada feature
