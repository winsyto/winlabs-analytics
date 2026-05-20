# 08 - Convenciones de código y trabajo

> Documento de Fase 6 (parte 1). Define cómo se escribe, organiza, revisa y entrega código en wlA. Apunta a calidad sin overhead.
> Última actualización: 2026-05-19.

---

## 1. Resumen

| Área | Convención |
|---|---|
| Idioma del código | **Inglés** (variables, funciones, tipos, comentarios técnicos) |
| Idioma de UI | **Español** (estamos vendiendo en LatAm) |
| TypeScript | Strict mode obligatorio en todo el monorepo |
| Linting | ESLint + Prettier, runs en CI |
| Commits | **Conventional Commits** (no enforced en MVP, sugerido) |
| Branches | trunk-based, feature branches cortas |
| PRs | Auto-review del autor antes de merge; CI verde obligatorio |
| Hooks pre-commit | Husky + lint-staged (lint + format del diff) |

---

## 2. Estructura del monorepo (recordatorio)

Definida en `03-arquitectura.md` §3.2. Resumida:

```
winlabs-analytics/
├── apps/
│   ├── cliente/              # Next.js — UI cliente final
│   └── console/              # Next.js — UI interna WinLabs
├── packages/
│   ├── db/                   # Schema, ORM client, queries, migrations
│   ├── ui/                   # shadcn + Tailwind (design system)
│   ├── types/                # Shared TS types
│   ├── auth/                 # NextAuth config + RLS helpers
│   ├── ai/                   # LLM provider abstraction
│   ├── integrations/         # Workflow runner core
│   └── config/               # ESLint, Tailwind, tsconfig shared configs
├── jobs/
│   └── trigger/              # Trigger.dev workflows
├── docs/                     # README, ADRs, runbooks
└── proyecto/                 # Documentos de diseño (este folder)
```

---

## 3. Idioma del código

### 3.1 Inglés para código

- Nombres de variables, funciones, tipos, archivos, comentarios técnicos: **inglés**.
- Razón: estándar SaaS, facilita contratación, librerías y docs en inglés, evita mezclar acentos en código.

### 3.2 Español para usuario final

- Toda la UI del Cliente (y Console) está en español por default.
- Textos en `packages/ui` y apps usan archivos de i18n (`next-intl` o equivalente) desde el día uno aunque solo soportemos un idioma — facilita agregar inglés/portugués en v2.x.

### 3.3 Comentarios

- Comentarios técnicos (explicaciones de algoritmos, decisiones de implementación): inglés.
- Comentarios de dominio (regla de negocio, especificación del cliente): pueden ir en español si la regla viene en español de la fuente.

---

## 4. TypeScript

### 4.1 Strict mode obligatorio

`tsconfig.json` compartido en `packages/config/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true
  }
}
```

### 4.2 `any` prohibido

- Prohibido `any` excepto en boundary con librería externa que no exporta tipos, y siempre acompañado de un cast explícito + comentario.
- Preferir `unknown` y narrowing.

### 4.3 Tipos vs Interfaces

- **`type`** para uniones, intersecciones, tipos derivados, tipos utilitarios.
- **`interface`** para shape de objetos exportable y extensible.
- En la práctica: `type` por default; `interface` solo si necesitamos extensión / declaration merging.

### 4.4 Branded types para IDs

Para evitar pasar un `userId` donde se espera `tenantId`:

```ts
type Brand<T, B> = T & { __brand: B };
type UserId = Brand<string, 'UserId'>;
type TenantId = Brand<string, 'TenantId'>;
```

Aplicar a tipos críticos del dominio (TenantId, UserId, PersonId).

### 4.5 Validación en boundaries

Todo input externo (request body, query params, file uploads, API responses) pasa por un schema Zod antes de entrar a la lógica de negocio.

---

## 5. Naming

### 5.1 Archivos

| Tipo | Convención | Ejemplo |
|---|---|---|
| Componentes React | PascalCase | `DashboardCard.tsx` |
| Hooks | camelCase con prefix `use` | `useTenantContext.ts` |
| Helpers / utilidades | camelCase | `formatCurrency.ts` |
| Server actions | camelCase | `updateIntegrationConfig.ts` |
| Schemas Zod | camelCase + sufijo `Schema` | `userSchema.ts` |
| Tipos | camelCase | `dashboardTypes.ts` |
| Tests | `*.test.ts` o `*.test.tsx` | `formatCurrency.test.ts` |
| Migraciones DB | timestamp + descripción kebab | `20260615_add_people_history.sql` |

### 5.2 Variables y funciones

- Variables: `camelCase`, descriptivas pero no excesivas.
- Funciones: `camelCase`, verbo + sustantivo (`getTenantById`, `runIntegration`).
- Booleanos: prefijos `is`, `has`, `should`, `can` (`isActive`, `hasAbsence`, `canEditDashboard`).
- Constantes top-level: `SCREAMING_SNAKE_CASE` (`MAX_UPLOAD_SIZE_MB`).
- Tipos / Interfaces: `PascalCase` (`Tenant`, `IntegrationRun`).
- Enums: `PascalCase`; valores en `SCREAMING_SNAKE_CASE` o `kebab-case` según el dominio (preferir union string types sobre enums TS cuando se pueda).

### 5.3 Componentes React

- Un componente por archivo (excepción: subcomponentes pequeños privados al archivo).
- Props como `{ComponentName}Props`:

```ts
type DashboardCardProps = {
  title: string;
  value: number;
  // ...
};

export function DashboardCard(props: DashboardCardProps) { ... }
```

---

## 6. Estructura interna de cada app Next.js

```
apps/cliente/
├── app/                       # App Router
│   ├── (auth)/               # Layout para login, recovery
│   ├── (dashboard)/          # Layout principal autenticado
│   │   ├── dashboards/
│   │   ├── integrations/
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── api/                  # Route Handlers (solo si son externos: webhooks, etc.)
│   ├── layout.tsx
│   └── page.tsx
├── components/               # Componentes específicos de esta app
│   ├── dashboards/
│   └── integrations/
├── lib/                      # Helpers específicos
├── server-actions/           # Server actions agrupadas por dominio
│   ├── integrations.ts
│   └── dashboards.ts
└── middleware.ts             # Auth + tenant routing
```

---

## 7. Manejo de errores

### 7.1 Tipos de error

```ts
// packages/types/errors.ts
export class AppError extends Error {
  code: string;
  statusCode: number;
  // ...
}

// Errores de dominio
export class UnauthorizedError extends AppError { ... }
export class TenantNotFoundError extends AppError { ... }
export class IntegrationRunError extends AppError { ... }
export class ValidationError extends AppError { ... }
```

### 7.2 Patrón en server actions

```ts
'use server';

export async function updateIntegrationConfig(input: unknown) {
  try {
    const parsed = updateConfigSchema.parse(input);  // Zod
    await requireSession();
    await assertCanEditIntegrations();

    // ... lógica
    return { ok: true, data: result };
  } catch (err) {
    return handleActionError(err);  // helper común
  }
}
```

`handleActionError` mapea:
- Zod error → `{ ok: false, error: { code: 'VALIDATION', issues: [...] } }`
- AppError → `{ ok: false, error: { code, message } }`
- Unknown → log Sentry + `{ ok: false, error: { code: 'INTERNAL' } }`

### 7.3 UI: toasts

- Para errores **transitorios** (fallo de red, integración falló): toast con sonner.
- Para errores **persistentes** (entidad no encontrada, sin permisos): página de error o banner inline.
- Para validaciones de formulario: errores inline en cada campo (react-hook-form + Zod resolver).

### 7.4 Error boundaries

- App Router tiene `error.tsx` por route segment. Implementar al menos uno top-level que loguee a Sentry y muestre fallback amistoso.
- Para componentes async pesados (dashboards), boundary específico que muestra retry.

### 7.5 Sentry

- `Sentry.captureException()` en `handleActionError` para los `INTERNAL`.
- No loguear PII en payloads de error (filtrar `email`, `phone`, etc.).
- Source maps subidos en CI.

---

## 8. Acceso a BD y RLS

### 8.1 Patrón

- Todo acceso a BD pasa por `packages/db`, que expone funciones tipadas.
- No se hacen queries inline en server actions.
- Cada función de BD asume que la sesión tenant ya está seteada (RLS hace el resto).

### 8.2 Helper de tenant context

```ts
// packages/auth/withTenant.ts
export async function withTenantContext<T>(
  tenantId: TenantId,
  fn: () => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}`);
    return fn();
  });
}
```

### 8.3 Tests RLS

Suite obligatoria en CI: para cada tabla de tenant, verifica que tenant A no puede leer tenant B aunque se intente sin RLS.

---

## 9. Reglas de UI / UX

### 9.1 Design system

- Todo componente UI base vive en `packages/ui` (shadcn copiados + extensiones).
- Apps NO copian componentes shadcn por separado.
- Tokens de diseño (colores, spacing, radios) centralizados en `packages/ui/tokens.ts` y exportados a Tailwind config.

### 9.2 Accesibilidad

- Etiquetas explícitas en todos los inputs.
- Contraste WCAG AA mínimo.
- Foco visible en navegación por teclado.
- Componentes shadcn ya cumplen base; cuidar custom code.

### 9.3 Loading states

- Cada interacción async muestra estado de loading (skeleton, spinner local, o disable de botón).
- Nunca freezar UI sin feedback.

### 9.4 Empty states

- Cada lista, tabla, dashboard sin datos tiene un empty state explicativo con CTA cuando aplique ("Configurá tu primera integración").

---

## 10. Testing

### 10.1 Pirámide

- **Unit** (Vitest): lógica pura, transformaciones, cálculos de métricas, parsers.
- **Integration** (Vitest + Postgres en Docker o Supabase local): server actions con BD real, runners de integración.
- **E2E** (Playwright): happy paths de Cliente y Console (login, ver dashboard, configurar integración).
- **RLS regression**: suite custom contra Postgres.

### 10.2 Cobertura objetivo MVP

- **Lógica de negocio crítica** (parsers, transforms, métricas, RLS): >70%.
- **Server actions críticas**: cubiertas por integration tests.
- **UI**: E2E happy-path, sin obsesionar con component tests salvo componentes complejos del design system.

### 10.3 Naming de tests

- `describe` con el nombre del módulo o función.
- `it` empieza con verbo en presente: `it('returns the headcount for a given period')`.
- Tests RLS: `it('does not leak rows from another tenant')`.

---

## 11. Performance

### 11.1 Frontend

- Server Components por default → menos JS al cliente.
- Imágenes con `next/image`.
- Lazy load de visualizaciones pesadas (`React.lazy` o dynamic import).
- TanStack Query con staleTime razonables (no re-fetch en cada navegación).

### 11.2 Backend

- Índices proactivos en columnas con WHERE / JOIN frecuente:
  - `(tenant_id, person_id)` en `time_daily`.
  - `(tenant_id, person_id, start_date)` en `absenteeism_events`.
  - GIN en `custom_fields` si se queryea seguido.
- Materialized views para dashboards si las queries pasan los 500ms; evaluar caso a caso.
- Caching de respuestas IA (mismo prompt + datos = misma respuesta por X horas).

---

## 12. Git, commits, branches, PRs

### 12.1 Branching

- `main` siempre deployable a producción.
- Feature branches cortas (1-3 días). Nombre: `feat/<area>-<descripcion>`, `fix/<area>-<descripcion>`.
- Rebase preferido sobre merge para mantener historia lineal.

### 12.2 Commits

**Conventional Commits** sugerido (no enforced en MVP):

```
feat(integrations): add manu api connector
fix(dashboards): correct turnover calculation when no terminations
chore(deps): bump next to 15.2
docs(roadmap): update m4 plan
```

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`.

### 12.3 PRs

- PR template con: qué cambia, por qué, cómo se prueba, riesgos.
- CI obligatorio verde antes de merge.
- Como sos solo en MVP: auto-review consciente (re-leer el diff completo antes de mergear). En v1.x si entra un freelancer, PR review humano obligatorio.

### 12.4 Pre-commit hooks (Husky + lint-staged)

- Lint + format del diff (no de todo el repo, así no rompe el flow).
- Type-check completo en pre-push (no pre-commit, por costo).

---

## 13. Security review (obligatorio)

Para cada PR que toca código sensible (auth, queries, integraciones, manejo de archivos):

- ✅ **SQL injection**: ¿usa el ORM con parámetros? Nunca string concat.
- ✅ **RLS**: ¿la nueva tabla / query respeta `tenant_id`? ¿se ejecutó `SET LOCAL`?
- ✅ **XSS**: ¿hay HTML renderizado de string del usuario sin sanitizar?
- ✅ **Auth**: ¿el endpoint requiere sesión? ¿valida permisos del usuario?
- ✅ **Secrets**: ¿hay un token / API key hardcoded?
- ✅ **Input validation**: ¿el input pasó por Zod antes de la lógica?
- ✅ **Rate limit**: ¿el endpoint público está protegido?
- ✅ **PII en logs**: ¿se filtran datos personales antes de loguear?
- ✅ **Auditoría**: ¿la acción sensible se registra en `audit_log`?
- ✅ **Tests**: ¿hay tests de los casos de borde (no auth, tenant cruzado, input inválido)?

Crear `docs/security-review-checklist.md` con este listado para copy-paste en PRs.

---

## 14. Documentación

### 14.1 Qué documentar

- **READMEs** de cada app y package: cómo correr, qué hace, decisiones clave.
- **ADRs** (Architecture Decision Records) en `docs/adr/`: una entrada por decisión arquitectónica significativa (ej: "ADR-001: Multi-tenancy via Postgres RLS").
- **Runbooks** en `docs/runbooks/`: cómo onboardear un tenant, cómo correr una integración manualmente, cómo investigar un run fallido.
- **`proyecto/`** (este folder): documentación de producto y diseño macro.

### 14.2 Qué NO documentar

- Comentarios obvios (`i++; // incrementar i`).
- README que solo repite el folder structure (Turborepo ya lo dice).
- Documentación que se desactualiza fácil (preferir documentar el "por qué", no el "cómo" — el código dice el cómo).

---

## 15. Librerías aprobadas / prohibidas

Ya enumeradas en `04-stack-tecnologico.md` §12-13. Cambios se proponen vía PR + entrada en `DECISIONS.md`.

---

## 16. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-062 | Código en inglés, UI en español | ✅ Cerrada |
| D-063 | TypeScript strict mode + noUncheckedIndexedAccess + exactOptionalPropertyTypes | ✅ Cerrada |
| D-064 | `any` prohibido salvo en boundaries de librerías sin tipos | ✅ Cerrada |
| D-065 | Validación con Zod en TODOS los boundaries (server actions, route handlers, file parsers) | ✅ Cerrada |
| D-066 | i18n desde día uno con `next-intl` aunque solo soportemos español | ✅ Cerrada |
| D-067 | Branded types para IDs críticos (TenantId, UserId, PersonId) | ✅ Cerrada |
| D-068 | Manejo de errores: tipos custom + helper `handleActionError` + Sentry | ✅ Cerrada |
| D-069 | Conventional Commits sugerido (no enforced) | ✅ Cerrada |
| D-070 | Pre-commit con Husky + lint-staged | ✅ Cerrada |
| D-071 | Security review checklist obligatorio en PRs sensibles | ✅ Cerrada |
| D-072 | ADRs en `docs/adr/` para decisiones arquitectónicas significativas | ✅ Cerrada |
| D-073 | Cobertura crítica >70% en lógica de negocio, E2E happy-path en UI | ✅ Cerrada |

---

## 17. Decisiones abiertas

- **Librería i18n exacta**: `next-intl` propuesto; alternativa `react-intl`. Cerrar al iniciar Fase 6 setup.
- **Hooks pre-push** (type-check completo): puede ser costoso, evaluar si vale la pena vs CI.
- **Política de freelancers**: cuándo y cómo se integran (v1.x+); requerirá PR review humano obligatorio.

---

## 18. Próximos pasos

→ Continúa con `09-setup-inicial.md`: checklist concreto y secuencial de pasos para bootstrappear el repo el día que decidas T0.
