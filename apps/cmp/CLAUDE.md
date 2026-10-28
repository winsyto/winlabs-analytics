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

## Rutas actuales

```
/login                          → LoginForm (credentials)
/dashboard                      → Placeholder
/tenants                        → Lista + crear tenant (roles, admin inicial y configuración de unidades por defecto)
/tenants/[tenantId]             → Detalle: info, módulos activos, dashboards, unidades organizativas y dimensiones (Headcount, Ausentismos, Horas extras, Rotación y Payroll), asistencia (modo, semana laboral y horas por defecto, formato horas/días, base de la tasa de horas extra, moneda de las liquidaciones), usuarios
/dashboards                     → Dashboards por tenant: matriz tenants × dashboards con interruptores, búsqueda y paginación (12 por página); bloquea activar uno sin los módulos de datos que requiere
/absence-types                  → Catálogo global de tipos de ausencia por defecto (lo heredan los tenants nuevos)
/time-entry-types               → Catálogo global de tipos de hora por defecto (nombre y categoría; lo heredan los tenants nuevos)
/tenants/[tenantId]/users       → Usuarios del tenant (crear, resetear contraseña)
/integrations                   → Integraciones de todos los tenants (crear, pausar/activar)
/integrations/[tenantIntegrationId] → Detalle de la integración y sus ejecuciones
/templates                      → Templates de integración (activar/inactivar)
/data-models                    → Módulos activos por tenant en una tabla (también se editan en el detalle del tenant)
```

La configuración de unidades organizativas y dimensiones por dashboard se administra en el detalle del tenant (ver `docs/modules/unidades-organizativas.md`).

## Notas

- El layout del dashboard está en `app/(dashboard)/layout.tsx`
- `app/page.tsx` redirige a `/dashboard`
- `proxy.ts` (no `middleware.ts`) maneja la protección de rutas
- Server actions en `_actions/` dentro de cada feature
