# apps/cliente — App de tenants

Ver contexto completo en `../../CLAUDE.md`.

## Qué hace esta app

App que usa cada empresa cliente. Multi-tenant: cada usuario pertenece a un tenant.
Muestra dashboards de People Analytics, gestión de usuarios, configuración de integraciones.

## Puerto

`localhost:3000`

## Auth

- Provider: Credentials con `tenantSlug` + `email` + `password`
- Sesión JWT con: `user.id`, `user.tenantId`, `user.tenantSlug`, `user.email`, `user.name`
- **IMPORTANTE:** `session.user.id` viene de `token.sub` — está mapeado explícitamente en el session callback
- Archivo: `apps/cliente/auth.ts`

## Rutas actuales

```
/login              → LoginForm (tenantSlug + email + password)
/dashboard          → Dashboard con stats del tenant
/reports            → Stub (pendiente M3)
/team               → Stub (pendiente M3)
/settings           → Stub
/settings/users     → Gestión de usuarios del tenant (cambiar rol, activar/desactivar)
```

## Permisos en settings/users

- Solo rol `admin` puede editar (cambiar rol, activar/desactivar)
- El rol se obtiene fresh desde BD en cada server action (no desde JWT)
- Un usuario no puede modificarse a sí mismo

## Notas

- Layout dashboard: `app/(dashboard)/layout.tsx` — fetchea nombre del tenant para el sidebar
- `proxy.ts` protege todas las rutas salvo `/login`
- Server actions siempre verifican `session.user.id` antes de operar
