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
/login              → LoginForm (credentials)
/dashboard          → Placeholder
/tenants            → Lista + crear tenant (con roles y admin inicial)
/users              → (pendiente) gestión de internal users
```

## Notas

- El layout del dashboard está en `app/(dashboard)/layout.tsx`
- `app/page.tsx` redirige a `/dashboard`
- `proxy.ts` (no `middleware.ts`) maneja la protección de rutas
- Server actions en `_actions/` dentro de cada feature
