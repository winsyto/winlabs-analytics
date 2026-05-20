# WinLabs Analytics

Plataforma SaaS multi-tenant de People Analytics para empresas LatAm.

- **App clientes:** `clients.winlabs.com.ar`
- **Console (CMP):** `console.winlabs.com.ar`

## Documentación de diseño

Ver [`proyecto/README.md`](./proyecto/README.md) — índice completo de decisiones de arquitectura, modelo de datos, stack, roadmap y convenciones.

## Stack

Next.js 15 · TypeScript · Prisma · PostgreSQL · Supabase · NextAuth v5 · Turborepo · Vercel

## Estructura del monorepo

```
apps/
  cliente/     → App de clientes (clients.winlabs.com.ar)
  console/     → CMP interno WinLabs (console.winlabs.com.ar)
packages/
  db/          → Prisma schema, client, migraciones
  ui/          → Componentes compartidos (shadcn/ui)
  auth/        → NextAuth config, helpers de permisos, withTenantContext
  types/       → Tipos TypeScript compartidos
  ai/          → Vercel AI SDK, providers
  integrations/→ ETL connectors (File-based, Manú, Geovictoria)
  config/      → tsconfig, eslint, tailwind base
jobs/
  trigger/     → Jobs Trigger.dev
docs/          → Documentación operativa (generada por SKILL 6)
proyecto/      → Documentos de diseño (source of truth de arquitectura)
```
