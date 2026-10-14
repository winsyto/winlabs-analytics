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
/login                          → LoginForm (tenantSlug + email + password)
/change-password                → Cambio obligatorio de contraseña (usuarios creados o reseteados desde el CMP)
/dashboard                      → Inicio con stats del tenant
/headcount                      → Dashboard 1 (Headcount): KPIs, gráficos por dimensión, filtros
/headcount/[scope]/[[...id]]    → Drill-down: activos, altas, bajas, dim/<tipo>/<id>
/headcount/export               → Descarga Excel/PDF (?format=xlsx|pdf)
/integrations                   → Carga de archivos: lista de integraciones del tenant
/integrations/[id]              → Subida de archivo, columnas del template y resultados de cada job
/reports, /team                 → Stubs
/settings                       → Stub
/settings/users                 → Gestión de usuarios del tenant (cambiar rol, activar/desactivar)
```

Documentación de los módulos: `docs/modules/dashboard-headcount.md`, `docs/modules/carga-de-archivos.md`. Para agregar un dashboard: skill `ADD_DASHBOARD`.

## Permisos en settings/users

- Solo rol `admin` puede editar (cambiar rol, activar/desactivar)
- El rol se obtiene fresh desde BD en cada server action (no desde JWT)
- Un usuario no puede modificarse a sí mismo

## Notas

- Layout dashboard: `app/(dashboard)/layout.tsx` — fetchea nombre del tenant para el sidebar
- `proxy.ts` protege todas las rutas salvo `/login`
- Server actions siempre verifican `session.user.id` antes de operar
