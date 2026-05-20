# 10 - Estándares y skills cross-cutting

> Documento de Fase 6 (parte 3 / extensión). Complementa `08-convenciones.md` con estándares específicos del producto y un set de **skills** reutilizables que aplicaremos en cada implementación. Basado en patrones validados en otros proyectos (AI-GEO-platform, Kaivia-HR, MetaXT/XTime).
> Última actualización: 2026-05-19.

---

## 1. Resumen

Este documento agrupa los estándares cross-cutting + los **skills** (procedimientos reproducibles) que dispararemos por trigger durante el desarrollo. Funciona como **catálogo de operación** para Claude Code y para Winsy.

| Sección | Qué define | Skill asociado |
|---|---|---|
| 2. Nombres en BD | Reglas de prefijos, tablas, columnas, índices, FKs, constraints | — |
| 3. Diccionario de datos y modelado | DBML como fuente única + Prisma sincronizado | **SKILL 7 [CMP_DB_MODELING]** |
| 4. UX / UI / themes | Sistema de diseño basado en AppShell de AI-GEO-platform | — |
| 5. Estilo del menú | Sidebar colapsable + topbar + project switcher | — |
| 6. Template estándar CRUD | Estructura repetible enterprise B2B | — |
| 7. Documentación de módulos | Cómo cerrar y documentar lo construido | **SKILL 6 [GENERATE_DOCUMENTATION]** |
| 8. Forma de trabajar con Claude Code | Criterios de implementación + cosas a evitar | — |
| 9. Integración LLM **user-facing** | Cada Server Action expuesta como herramienta al agente del usuario | **SKILL 9 [AI_AGENT_TOOLING_INTEGRATION]** |
| 10. Migraciones y seeds | Migraciones Prisma + seeds modulares idempotentes | **SKILL 10 [PRISMA_SEED_AND_MIGRATE]** |
| 11. Caché y performance | `unstable_cache` + `revalidateTag` + `React.cache` | **SKILL 11 [PERFORMANCE_CACHE_STRATEGY]** |
| 12. Auditoría | Modelo, qué se audita, cómo se consulta | — |

> **Nota sobre ORM**: a partir de este documento, la recomendación cambia de Drizzle a **Prisma**, alineando con el workflow existente de Winsy (AI-GEO-platform, Kaivia, MetaXT) y con SKILL 7. Ver D-095.

---

## 2. Convención de nombres para catálogo de BD

### 2.1 Prefijos (taxonomía de tablas)

Inspirado en MetaXT y adaptado a wlA. Cada tabla lleva un prefijo de 2-4 letras separando dominios funcionales:

| Prefijo | Dominio | Ejemplos |
|---|---|---|
| `sec_` | Seguridad (usuarios, roles, permisos, sesiones, audit) | `sec_users`, `sec_roles`, `sec_permissions`, `sec_user_roles`, `sec_audit_log` |
| `wla_` | Núcleo de la plataforma (tenants, internal users, config) | `wla_tenants`, `wla_internal_users`, `wla_data_models` |
| `hr_` | People Analytics — primer vertical | `hr_people`, `hr_people_history`, `hr_areas`, `hr_positions`, `hr_locations` |
| `att_` | Time & Attendance / Asistencia | `att_time_daily`, `att_absenteeism_events`, `att_absenteeism_types` |
| `pay_` | Payroll | `pay_periods`, `pay_entries`, `pay_concepts` |
| `int_` | Integraciones (templates, configuraciones por tenant, runs, sources) | `int_templates`, `int_tenant_integrations`, `int_runs`, `int_source_credentials` |
| `dsh_` | Dashboards (configs, plantillas, customizaciones) | `dsh_configs`, `dsh_templates`, `dsh_views` |
| `ai_` | Capa de IA (uso, prompts, configuración por tenant) | `ai_usage`, `ai_prompt_templates`, `ai_tenant_config` |
| `nav_` | Navegación (menú, reports) — gestión manual DBA | `nav_menu`, `nav_reports` |
| `cfg_` | Catálogos / configuración estática | `cfg_termination_reasons`, `cfg_contract_types`, `cfg_tenant_statuses` |

> Los prefijos no son cosmética: facilitan filtrar tablas en pgAdmin, ordenar el esquema y aislar dominios. Cuando un dominio nuevo entra (Finance, CRM), inventamos un prefijo nuevo (`fin_`, `crm_`).

### 2.2 Tablas

- **Plural y snake_case**: `hr_people`, `att_absenteeism_events`, `int_runs`.
- Sin prefijo redundante (`hr_people`, no `hr_hr_people`).
- Tablas de relación N:N: `<prefijo>_<a>_<b>` orden alfabético: `sec_user_roles`.
- History / snapshot: sufijo `_history`: `hr_people_history`.
- Catálogos: prefijo del dominio + sustantivo plural: `cfg_absenteeism_types`, `cfg_termination_reasons`.

### 2.3 Columnas

- **snake_case** siempre.
- PK: `id` (preferentemente `Int autoincrement`, salvo seguridad global o logs que requieran UUID — ver D-099).
- FK: `<entidad_singular>_id`: `tenant_id`, `person_id`, `area_id`, `manager_id`.
- Booleanos: prefijo `is_` / `has_` / `should_` / `can_`: `is_active`, `has_absence`.
- Timestamps: `created_at`, `updated_at`, `deleted_at` (soft delete), todos `timestamptz`.
- Fechas de dominio: `<verbo o sustantivo>_date`: `hire_date`, `termination_date`.
- Cantidades: sufijos `_count` / `_hours` / `_amount`: `days_count`, `worked_hours`.
- Custom fields por tenant: una columna `custom_fields JSONB` por tabla core.

### 2.4 Claves, restricciones e índices

- **PK**: `id Int PRIMARY KEY DEFAULT autoincrement()`. Excepciones (UUID): `sec_audit_log`, `sec_sessions`, `int_runs`.
- **FK explícita**: `fk_<tabla>_<columna>`.
- **Unique**: `uq_<tabla>_<columnas>`. Las claves naturales por tenant siempre incluyen `tenant_id`: `uq_hr_people_tenant_id_employee_code`.
- **Check**: `ck_<tabla>_<regla>`.
- **Índices**: `ix_<tabla>_<columnas>`. Política: índice en cada FK + índices compuestos con `tenant_id` como primer campo en hot queries.

### 2.5 RLS y `tenant_id`

- Todas las tablas con datos del tenant llevan `tenant_id` + RLS policy estándar:

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <tabla>
  USING (tenant_id = current_setting('app.current_tenant_id')::int)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::int);
```

> Si el PK del tenant es UUID en lugar de Int, ajustar el cast (`::uuid`). Definir esto al inicio del Paso 6 del setup (`09-setup-inicial.md`).

### 2.6 Soft delete

- Soft delete (`deleted_at timestamptz NULL`) en tablas con valor de auditoría: `hr_people`, `int_tenant_integrations`, `sec_users`, `dsh_configs`.
- Hard delete en tablas con churn alto o sin valor histórico: `int_runs` (con política de retención), `ai_usage`.
- El wrapper de Prisma filtra `deleted_at IS NULL` por default; opt-out explícito si hace falta consultar archivados.

---

## 3. Diccionario de datos y modelado

### SKILL 7: [CMP_DB_MODELING]

**Trigger:** cuando el usuario solicite crear o modificar tablas en la base de datos de wlA.

**Objetivo:** mantener **sincronía perfecta** entre el diccionario de datos (`/docs/database/wla_schema.dbml`) y Prisma (`/prisma/schema.prisma`), respetando la taxonomía de prefijos (§2.1) y garantizando documentación viva del modelo.

#### 3.1 Reglas de nomenclatura (estrictas)

Las definidas en §2: prefijos, snake_case en BD, PascalCase singular en modelos Prisma, claves naturales con `tenant_id`, etc.

#### 3.2 Reglas de documentación (estrictas)

- **En DBML:** toda tabla DEBE tener un bloque `Note: '...'` al final de su definición. Todo campo DEBE incluir `[note: '...']` con su propósito, validaciones y posibles valores enum.
- **En Prisma:** toda tabla y cada campo DEBEN estar precedidos por comentario de documentación `/// Descripción` para activar IntelliSense en el editor.

#### 3.3 Procedimiento obligatorio

1. **DBML primero**: todo cambio se escribe primero en `/docs/database/wla_schema.dbml` con las notas descriptivas.
2. **Prisma después**: reflejar el cambio en `/prisma/schema.prisma` (`PascalCase` singular para modelos) incluyendo los comentarios `///`.
3. **PK por defecto**: `id Int @id @default(autoincrement())`. Excepción documentada para tablas de seguridad/logs que usen UUID.
4. **Tenant scope**: si la tabla pertenece a un tenant, agregar `tenant_id Int` + relación + index + agregar la policy RLS en la migración SQL.
5. **Audit**: si la tabla es sensible (config, datos personales, integración), el wrapper de Server Action genera entrada en `sec_audit_log` automáticamente (ver §12 y §6).

#### 3.4 Ejemplo DBML

```dbml
Table hr_people {
  id              int           [pk, increment]
  tenant_id       int           [not null, ref: > wla_tenants.id, note: 'Tenant al que pertenece el empleado (RLS)']
  employee_code   varchar(50)   [not null, note: 'Código único del empleado por tenant. Clave natural de reconciliación con fuentes externas.']
  first_name      varchar(100)  [not null]
  last_name       varchar(100)  [not null]
  email           varchar(255)  [note: 'Email corporativo si existe.']
  hire_date       date          [not null]
  termination_date date         [note: 'NULL mientras el empleado esté activo. Debe ser >= hire_date.']
  status          varchar(20)   [not null, default: 'active', note: 'Valores: active | inactive | on_leave']
  area_id         int           [ref: > hr_areas.id]
  position_id     int           [ref: > hr_positions.id]
  manager_id      int           [ref: > hr_people.id, note: 'FK recursiva al manager directo.']
  custom_fields   jsonb         [note: 'Extensiones por tenant. Schema validado en Console.']
  created_at      timestamptz   [not null, default: `now()`]
  updated_at      timestamptz   [not null, default: `now()`]
  deleted_at      timestamptz   [note: 'Soft delete; NULL = activo.']

  indexes {
    (tenant_id, employee_code) [unique, name: 'uq_hr_people_tenant_employee_code']
    (tenant_id, area_id)
    (tenant_id, status)
  }

  Note: 'Personas del tenant. Origen: integraciones HR (Manú, archivo XLS, etc.). RLS por tenant_id.'
}
```

#### 3.5 Ejemplo Prisma

```prisma
/// Personas del tenant. Origen: integraciones HR (Manú, archivo XLS, etc.). RLS por tenant_id.
model HrPerson {
  /// Identificador interno autoincrement
  id Int @id @default(autoincrement())

  /// Tenant al que pertenece el empleado (RLS)
  tenantId Int @map("tenant_id")
  tenant   WlaTenant @relation(fields: [tenantId], references: [id])

  /// Código único del empleado por tenant. Clave natural de reconciliación.
  employeeCode String @map("employee_code") @db.VarChar(50)

  /// Nombre
  firstName String @map("first_name") @db.VarChar(100)

  /// Apellido
  lastName String @map("last_name") @db.VarChar(100)

  /// Email corporativo (opcional)
  email String? @db.VarChar(255)

  /// Fecha de contratación
  hireDate DateTime @map("hire_date") @db.Date

  /// NULL si el empleado sigue activo
  terminationDate DateTime? @map("termination_date") @db.Date

  /// active | inactive | on_leave
  status String @default("active") @db.VarChar(20)

  /// FK a HrArea
  areaId Int? @map("area_id")
  area   HrArea? @relation(fields: [areaId], references: [id])

  /// FK a HrPosition
  positionId Int? @map("position_id")
  position   HrPosition? @relation(fields: [positionId], references: [id])

  /// FK recursiva al manager directo
  managerId Int? @map("manager_id")
  manager   HrPerson? @relation("PeopleManager", fields: [managerId], references: [id])
  reports   HrPerson[] @relation("PeopleManager")

  /// Extensiones por tenant. Schema validado en Console.
  customFields Json @default("{}") @map("custom_fields")

  /// Timestamps
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@unique([tenantId, employeeCode], name: "uq_hr_people_tenant_employee_code")
  @@index([tenantId, areaId])
  @@index([tenantId, status])
  @@map("hr_people")
}
```

#### 3.6 Dónde vive todo

| Archivo | Rol |
|---|---|
| `/docs/database/wla_schema.dbml` | Diccionario de datos navegable (fuente única para revisión humana / dbdiagram.io). |
| `/prisma/schema.prisma` | Implementación que Prisma usa para generar el cliente + migraciones. |
| `/prisma/migrations/<timestamp>_<descripcion>/migration.sql` | Migraciones versionadas; ahí también van los `CREATE POLICY` de RLS. |
| `/docs/database/changelog.md` | Una línea por cambio significativo de schema (link a ADR si aplica). |

#### 3.7 Errores frecuentes a evitar

- ⛔ Tocar Prisma sin actualizar el DBML primero.
- ⛔ Definir tabla nueva sin `Note:` ni `[note: '...']`.
- ⛔ Olvidar `tenant_id` + RLS policy en tabla con datos del tenant.
- ⛔ Usar UUID por default; UUID solo en seguridad/logs documentados.

---

## 4. UX / UI y themes

> Tomamos el **AppShell** validado en AI-GEO-platform como base. Diferencias: la paleta de wlA usa **azul** como color primario en lugar de rojo, manteniendo el resto del esquema (sidebar oscuro, topbar gris medio, contenido claro).

### 4.1 Layout macro (basado en AI-GEO-platform)

```
┌──────────────────────────────────────────────────────────────┐
│ Topbar (h-14)  ────── dark grey ─────────────────────────────│
│ [vacío]                          [ProjectSwitcher] [🔔] [👤] │
├─────────────┬────────────────────────────────────────────────┤
│             │                                                │
│  Sidebar    │  PageHeader (eyebrow + título + actions)       │
│  (dark)     │  ────────────────────────────────────────────  │
│             │                                                │
│  [WL]       │  Contenido (cards bg-card sobre bg)            │
│  WinLabs    │                                                │
│  Analytics  │                                                │
│             │                                                │
│  [≡ toggle] │                                                │
│             │                                                │
│  ▸ Dash..   │                                                │
│  ▸ Integr.. │                                                │
│  ▸ Settings │                                                │
│             │                                                │
└─────────────┴────────────────────────────────────────────────┘
```

### 4.2 Componentes de layout (reutilizar el patrón AI-GEO)

| Componente | Rol | Ubicación |
|---|---|---|
| `AppShell` | Server component. Resuelve user + context + nav groups. | `apps/<app>/components/layout/app-shell.tsx` |
| `AppShellFrame` | Client. Maneja sidebar collapsed/expanded + grid layout. | idem |
| `Topbar` | Project switcher + notifications + user menu. | idem |
| `SidebarNav` | Render de grupos + items + estados activo/pending. | idem |
| `PageHeader` | `eyebrow` (color primary) + `title` + slot `actions`. | `packages/ui/page-header.tsx` |
| `KpiCard` | Card con título mute + chip auxiliar + valor grande. | `packages/ui/kpi-card.tsx` |
| `DataPanel` | Card contenedora para tablas / charts. | `packages/ui/data-panel.tsx` |
| `EmptyState` | Estado vacío con icono + texto + CTA. | `packages/ui/empty-state.tsx` |
| `Loader` | Indicador "scanner" sutil para estados pending. | `packages/ui/loader.tsx` |

### 4.3 Paleta (CSS variables — basado en AI-GEO con rojo → azul)

```css
:root {
  /* Surfaces */
  --background: #f4f5f2;          /* off-white */
  --foreground: #101214;
  --card: #ffffff;
  --card-foreground: #101214;
  --popover: #ffffff;
  --muted: #eceee8;
  --muted-foreground: #687078;
  --accent: #d7dad2;
  --accent-foreground: #101214;
  --border: #d8dbd2;
  --input: #d8dbd2;

  /* Primary — azul WinLabs (a confirmar el hex exacto) */
  --primary: #1d4ed8;             /* placeholder: azul royal */
  --primary-foreground: #ffffff;
  --secondary: #17191d;
  --secondary-foreground: #f5f5f0;

  /* Semánticos */
  --destructive: #b4232a;
  --destructive-foreground: #ffffff;
  --success: #22a06b;
  --warning: #f2c94c;
  --info: #1d4ed8;

  /* Ring + chart */
  --ring: #1d4ed8;
  --chart-1: #1d4ed8;
  --chart-2: #101214;
  --chart-3: #9ea3a8;
  --chart-4: #f2c94c;
  --chart-5: #22a06b;

  /* Sidebar */
  --sidebar: #2c3238;
  --sidebar-foreground: #f5f5f0;
  --sidebar-primary: #1d4ed8;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: rgba(255, 255, 255, 0.08);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.1);
  --sidebar-active: #f5f5f0;
  --sidebar-active-foreground: #101214;

  /* Topbar */
  --topbar: #363d43;
  --topbar-foreground: #f5f5f0;
  --topbar-border: rgba(255, 255, 255, 0.12);

  --radius: 0.5rem;
}
```

> El hex exacto del azul WinLabs se cierra cuando me pases (o definamos) el tono de marca. Mientras tanto, `#1d4ed8` (Tailwind blue-700) es placeholder.

### 4.4 Tipografía

- **Familia**: Arial / Helvetica (igual que AI-GEO-platform — pragmático, sin descargas, performance perfecto). Inter queda como alternativa si más adelante queremos un toque más moderno.
- **Escala**: usar la default de Tailwind (`text-xs` → `text-3xl`).
- **Pesos**: 400 normal, 500 medium para énfasis, 600 semibold para títulos.

### 4.5 Estados visuales estándar

| Estado | Patrón |
|---|---|
| Loading | Skeleton para listas/dashboards; `Loader` (scanner sutil) para navegación; spinner inline en botones de acción. |
| Empty | `EmptyState` con icono Lucide grande + texto + CTA cuando aplique. |
| Error (recuperable) | Banner inline en el contenedor afectado. |
| Error (fatal) | Página completa con error boundary. |
| Success acción | Toast con sonner. |
| Pending navegación | Loader pequeño en el item del sidebar (igual que AI-GEO). |

### 4.6 Diferenciación Cliente vs Console (opcional, ajuste fino)

- **Cliente**: paleta tal cual la propuesta. Sidebar oscuro + accent azul.
- **Console**: misma estructura, pero con un *eyebrow* visible "WinLabs Console" en la topbar para que el operador interno sepa dónde está. Misma paleta — la diferenciación viene del contexto, no del color.

### 4.7 Themes (light / dark)

- **MVP**: light only.
- **v1.x**: dark mode opcional (basta con sobrescribir las CSS variables como hace AI-GEO en `.dark`).

### 4.8 Iconografía

- **Lucide React** exclusiva (igual que AI-GEO). Sin Heroicons ni FontAwesome.
- Tamaños base: `size-4` inline, `size-5` standalone, `size-6` en cards/titles.

### 4.9 Accesibilidad

- Contraste WCAG AA mínimo.
- Foco visible en navegación por teclado.
- Atributos `aria-*` cuando shadcn no los provea natural.
- Tab order lógico en formularios.

### 4.10 Ejemplo visual mental

El layout final luce como la captura del dashboard de AI-GEO (sidebar oscuro a la izquierda con logo "WL" cuadrado, topbar gris medio con project switcher + notificaciones + avatar, contenido blanco sobre fondo off-white con cards limpias y separación clara). Lo único que cambia es **rojo → azul** como acento.

---

## 5. Estilo del menú y navegación

> Idea general acordada (puede ajustarse en implementación). Estructura inspirada en `sidebar-nav.tsx` de AI-GEO.

### 5.1 Sidebar

- **Colapsable** (icon-only 72px ↔ icon+label 248px). Estado default: **colapsado** (igual que AI-GEO).
- **Logo + brand** en la cabecera del sidebar (`WL` cuadrado + "WinLabs Analytics" / "Analytics Console" debajo cuando expandido).
- **Toggle** debajo del logo con `PanelLeftOpen` / `PanelLeftClose` (Lucide).
- **Grupos colapsables**: cuando un grupo tiene >1 item, al click se expande mostrando los items hijos.
- **Item activo**: bg claro (`--sidebar-active`) + foreground oscuro.
- **Item hover**: bg semitransparente blanco.

### 5.2 Secciones (Cliente — propuesta inicial)

- **Dashboards** (grupo): Cubo / Headcount, Ausentismos, Horas extras, Turnover.
- **Integraciones**: estado + configuración.
- **Settings** (grupo): Usuarios y roles, Integraciones disponibles, Preferencias.

### 5.3 Secciones (Console — propuesta inicial)

- **Tenants**: alta, lista, detalle.
- **Modelos de datos**: catálogo + activación por tenant.
- **Integraciones**: catálogo + cross-tenant.
- **Usuarios internos**.
- **Auditoría**: vista cross-tenant.
- **Salud** (v1.x+).

### 5.4 Topbar

- Logo del producto **NO** en topbar (vive en sidebar).
- **ProjectSwitcher / TenantSwitcher** en la derecha, solo si el usuario tiene acceso a >1 tenant.
- **Notificaciones** (campanita).
- **UserMenu** con avatar + dropdown (perfil, change password, my client, logout).

### 5.5 Breadcrumbs

- Renderizados por `MainLayout` globalmente (no por cada ViewClient). Ver §6 — regla anti-duplicación.

### 5.6 Mobile

- MVP: responsive básico (sidebar colapsa a drawer en <lg).
- v2.x: evaluar app nativa o PWA según demanda.

---

## 6. Template estándar para CRUDs

Estructura repetible para entidades administrables (tenants, integraciones, usuarios, roles, áreas, posiciones, etc.). Esto hace que un nuevo CRUD se haga en horas, no días.

### 6.1 Páginas

1. **Lista**: `/<entidad>` — tabla con paginación, filtros, búsqueda. Acciones por fila.
2. **Detalle**: `/<entidad>/[id]` (opcional). Tabs si tiene relaciones.
3. **Crear**: modal `<Dialog>` sobre la lista (NO ruta separada salvo necesidad excepcional).
4. **Editar**: modal `<Dialog>` sobre la lista o detalle.

### 6.2 UI/UX estándar (enterprise B2B)

#### Page Header

- ⛔ **PROHIBIDO** renderizar `<Breadcrumbs>` dentro del ViewClient. `MainLayout` ya los inyecta globalmente. Agregarlos en el ViewClient produce duplicación visual.
- ⛔ **NO** incluir `menuItems` en las props del ViewClient/View/page si su único uso era para `<Breadcrumbs>`. Eliminar esa dependencia del chain.
- **Izquierda**: ícono del módulo (`bg-primary/10`) + título (`text-xl font-semibold`) + subtítulo descriptivo (`text-xs text-muted-foreground`).
- **Derecha**: grupo de botones de acción, en este orden:

  1. **Botón "Exportar"** (OBLIGATORIO y funcional)
     - ✅ SIEMPRE implementado como `<DropdownMenu>` con dos opciones por defecto: **Excel (.xlsx)** y **PDF (.pdf)**.
     - Crear `lib/export/<entity>-export.ts` con `export<Entity>ToExcel(rows)` y `export<Entity>ToPDF(rows)`.
     - Botón muestra estado `isExporting` con texto "Exportando..." y `disabled` durante la operación.
     - ⛔ PROHIBIDO dejar el botón "Exportar" con `disabled` sin opciones. Debe estar 100% funcional desde el primer deploy.

  2. **Botón "Herramientas"** (`variant="outline"`)
     - Obligatorio en la UI. Si no tiene opciones funcionales definidas, debe estar `disabled={true}` (no se omite).

  3. **Botón principal "+ Crear <Entidad>"** (`variant="default"`)
     - Abre el `<Dialog>` de creación.

#### Contenedor principal de datos (Card / Box)

- **Topbar de tabla**: fila de filtrado en la parte superior del contenedor con un Input de búsqueda global (con ícono de lupa) y filtros adicionales en chips.
- **DataGrid**: uso estricto de shadcn DataTable.

  - **Paginación y filtrado**: 100% **server-side**, escribiendo y leyendo Search Params en la URL (`?page=1&query=texto`).
  - **Ordenamiento**: las columnas principales clickeables. Estado `?sortBy=campo&sortOrder=asc|desc` en la URL. Usar helper `SortIcon` que muestra `ArrowUp`/`ArrowDown` con `text-primary` en la columna activa y `ArrowUpDown` opaco en las inactivas.
  - **Default ordering**: SIEMPRE definir un orderBy por defecto en el backend (`orderBy: { id: 'asc' }`) si la URL no especifica ninguno.

- **Columna de Acciones**: celda final anclada a la derecha con un Dropdown (ícono de 3 puntos horizontales) con: "Editar", "Ver Detalles" (si aplica), "Eliminar" (con alerta de confirmación).

#### Formularios

- **Básicos / intermedios**: renderizados dentro de un componente `<Dialog>` (modal central superpuesto) de shadcn UI, para mantener el foco sin abandonar la grilla.
- ⛔ **NO usar `Sheet`** (paneles laterales) para CRUDs estándar.
- Formularios complejos con muchos pasos: en ruta dedicada con wizard, no en dialog.

### 6.3 Componentes reutilizables (en `packages/ui/crud/`)

- `<CrudListPage>`: layout + título + grupo de acciones.
- `<CrudTable>`: shadcn DataTable preconfigurada con sorting/filtering/paginación server-side.
- `<CrudSearchBar>`: input de búsqueda global + chips de filtros.
- `<CrudForm>`: react-hook-form + Zod + grid de campos.
- `<CrudActionsCell>`: dropdown de 3 puntos con Editar / Ver / Eliminar.
- `<CrudDeleteDialog>`: confirmación de borrado con validación opcional (tipear el nombre).
- `<ExportDropdown>`: dropdown estándar con Excel/PDF.

### 6.4 Capa de datos

Para cada entidad:

- `packages/db/queries/<entidad>.ts`: funciones tipadas (`list`, `getById`, `create`, `update`, `softDelete`).
- `apps/<app>/server-actions/<entidad>.ts`: server actions que envuelven queries con permisos + auditoría + validación Zod + `// @ai-tool` (§9).
- `lib/export/<entidad>-export.ts`: funciones de exportación a XLSX y PDF.

### 6.5 Permisos

Estandarizado:

- `can<Entity>Read` / `can<Entity>Create` / `can<Entity>Update` / `can<Entity>Delete`.
- Defaults: tenant admin → todo dentro del tenant; viewer → solo lectura.

### 6.6 Auditoría automática

Cada `create`, `update`, `delete` de CRUD se loguea en `sec_audit_log` automáticamente vía wrapper de server action (ver §12).

---

## 7. Documentación de módulos

### SKILL 6: [GENERATE_DOCUMENTATION]

**Trigger:** se activa cuando Winsy diga "Documentar este módulo", "Cerrar funcionalidad" o "Generar docs".

**Acción:** generar contenido para un archivo `.md` en `/docs/modules/<modulo>.md` (o `/docs/architecture/<tema>.md` si es global).

#### 7.1 Estructura obligatoria

```markdown
# <Título del módulo>

**Fecha:** YYYY-MM-DD
**Estado:** Borrador | MVP | Final
**Owner técnico:** <nombre>

## Resumen

<1 párrafo: qué hace este módulo, para quién, qué problema resuelve.>

## Arquitectura

### Tablas involucradas
- `<prefijo>_<tabla>`: <rol breve>
- ...

### Archivos clave
- **Server Actions**: `apps/<app>/server-actions/<archivo>.ts`
- **Componentes UI**: `apps/<app>/.../<componente>.tsx`
- **Queries de BD**: `packages/db/queries/<archivo>.ts`
- **Tipos**: `packages/types/<archivo>.ts`
- **Tools del agente** (si aplica): registrados en `packages/ai/tools.ts`

### Diagrama (Mermaid, si aplica)

\`\`\`mermaid
sequenceDiagram
  Usuario->>UI: dispara acción
  UI->>ServerAction: invoca
  ServerAction->>DB: query/mutation
  DB-->>ServerAction: rows
  ServerAction-->>UI: { ok, data }
\`\`\`

## Decisiones (ADR)

### ADR-XXX: <Título de la decisión>
- **Contexto**: ...
- **Decisión**: ...
- **Alternativas descartadas**: ...
- **Consecuencias**: ...

## Flujo / Uso

<Cómo se usa el módulo desde la perspectiva del usuario final + cómo se extiende o mantiene desde la perspectiva técnica.>

## Cómo extender

<Pasos concretos para agregar una variante / un caso nuevo / una integración nueva sobre este módulo.>

## Pendientes / decisiones abiertas

- [ ] ...

## Changelog

| Fecha | Cambio | PR |
|---|---|---|
| 2026-MM-DD | Versión inicial | #123 |
```

#### 7.2 Reglas

- **Markdown estándar**. Si aplica, incluir Mermaid para diagramas.
- **Sin redundancia con el código**: documentar el "por qué" y los "qué", no el "cómo línea por línea".
- **Actualizar el changelog en cada cambio significativo**.
- **ADRs cortos**: si la decisión es trivial, una sola línea en una tabla.

#### 7.3 Dónde vive cada tipo de doc

| Carpeta | Contenido |
|---|---|
| `/proyecto/` | Documentación de producto y diseño macro (este folder). |
| `/docs/modules/` | Una entrada por módulo funcional (people, absenteeism, time, payroll, integraciones, etc.). |
| `/docs/architecture/` | Decisiones globales (multi-tenant, auth, IA, observabilidad). |
| `/docs/database/` | Diccionario DBML + changelog de schema (§3). |
| `/docs/runbooks/` | Procedimientos operativos paso a paso. |
| `/docs/adr/` | Architecture Decision Records con frontmatter (fecha, estado). |

---

## 8. Cómo trabajar con Claude Code (forma + criterios)

> Esto NO es producto: es la forma en que Winsy y Claude Code colaboran durante el desarrollo. Reemplaza la sección anterior que mezclaba tooling de dev con AI del producto.

### 8.1 Criterios de implementación (etapas)

Cada feature / funcionalidad se trabaja por **etapas**, no en un solo bloque:

1. **Definir objetivo** — qué tiene que pasar al final, en una línea.
2. **Definir archivos** — qué archivos vamos a tocar / crear (antes de codear).
3. **Implementar** — escribir el código.
4. **Validar** — correr lint, type-check, tests; verificar manualmente si aplica.
5. **Documentar lo mínimo necesario** — actualizar runbook / module doc si aplica (ver SKILL 6).
6. **Continuar** — pasar al siguiente.

### 8.2 Cosas a evitar (no negociable)

- ⛔ **Refactors grandes sin necesidad**. Si una refactor no resuelve un problema concreto, no se hace.
- ⛔ **Abstracciones prematuras**. Crear interfaces / capas "por si acaso" pudre el código rápido.
- ⛔ **Duplicación obvia**. La regla "DRY" se aplica solo cuando ya hay dos casos reales, no antes.
- ⛔ **Dependencias innecesarias**. Cada npm install pide justificación.
- ⛔ **Lógica de dominio mezclada con UI**. Server actions y queries en archivos separados de componentes.
- ⛔ **Endpoints API cuando Server Actions alcanzan**. Route handlers solo para webhooks, callbacks externos, o cosas que server actions no cubren.

### 8.3 CLAUDE.md / AGENTS.md

- **`CLAUDE.md` en la raíz** del repo. Contexto de alto nivel que Claude Code lee al arrancar.
- Contiene: stack, ubicaciones clave, comandos comunes (`pnpm dev`, `pnpm test`, `pnpm migrate`), patrones obligatorios (RLS, Zod, etc.), enlaces a `proyecto/` y `docs/`.
- Lista breve de **skills activos** (los de este documento) con sus triggers.

### 8.4 Skills propios del proyecto

En `.claude/skills/` (o equivalente):

- `add-table.md` — paso a paso para agregar una tabla nueva (DBML → Prisma → migración → RLS → queries → tests → diccionario).
- `add-crud.md` — paso a paso para implementar un CRUD entero con el template del §6.
- `add-integration.md` — paso a paso para crear una integración nueva.
- `add-dashboard.md` — paso a paso para agregar un dashboard nuevo.
- `add-ai-tool.md` — paso a paso para registrar una server action como tool del agente (SKILL 9).

### 8.5 Boundary de lo que Claude Code puede ejecutar

- Puede leer todo el repo.
- ⛔ NUNCA ejecutar:
  - `prisma migrate deploy` o `prisma db push` contra producción.
  - Cualquier comando de delete masivo en BD.
  - Despliegues sin confirmación explícita.
- ⛔ NUNCA tocar `nav_menu` / `nav_reports` via seed o script (§10).

---

## 9. Integración LLM user-facing (capa AI del producto)

### SKILL 9: [AI_AGENT_TOOLING_INTEGRATION]

**Trigger:** siempre que se cree o modifique una Server Action de mutación (create/update/delete) o una query compleja. También al crear un nuevo módulo CRUD completo.

**Objetivo:** asegurar que cada capacidad del backend sea **descubrible** por el agente de usuario de wlA. Cada acción que un humano puede ejecutar desde la UI debe poder ejecutarse vía lenguaje natural en el chat.

### 9.1 Regla de Oro

> "Si lo hace un humano, lo hace el agente."

Toda Server Action **DEBE** tener su Tool Definition correspondiente en `packages/ai/tools.ts`. Sin excepciones.

### 9.2 Pasos de ejecución obligatorios

#### Paso 1 — `// @ai-tool` block en la Server Action

Agregar al inicio del archivo (o de la función si el archivo tiene múltiples herramientas):

```typescript
// @ai-tool
// name: "create_integration"
// displayName: "Crear Integración"
// description: "Crea una nueva configuración de integración para el tenant activo. Úsala cuando el usuario diga 'agregar integración', 'conectar X', 'configurar fuente de datos'."
// category: "config"
// type: "mutation"
// requiredPermission: { resource: "integrations", action: "create" }
// uiResponse: "SUCCESS_CARD"
```

#### Paso 2 — Registrar la tool en `packages/ai/tools.ts`

- Importar el tipo `AiToolDefinition` de `@/packages/ai/tool-types`.
- Agregar la entrada al array `AI_TOOLS` siguiendo la estructura tipada.
- Los `parameters` deben coincidir EXACTAMENTE con el schema Zod de validación de la acción.
- Asignar `uiResponse` correcto según la tabla del Paso 4.

#### Paso 3 — Seguridad (CRÍTICO — no negociable)

- ⛔ PROHIBIDO que el agente reciba/pase `tenantId`, `userId`, `clientId` como parámetros. Estos se obtienen siempre desde `getSession()` en el backend.
- ✅ OBLIGATORIO: `requiredPermission` debe reflejar exactamente el resource+action que `checkAuth()` valida en la acción real.
- La herramienta NUNCA expone datos fuera del scope del tenant activo (RLS implícita por arquitectura).
- Tools de tipo `mutation` con efectos destructivos requieren confirmación del usuario antes de ejecutarse (el chat muestra "vas a borrar X, ¿confirmás?").

#### Paso 4 — Categorías válidas y `uiResponse` esperado

| Categoría | Descripción | uiResponse recomendado |
|---|---|---|
| `config` | CRUDs de configuración (catálogos, reglas, integraciones) | `SUCCESS_CARD` / `DATA_TABLE` |
| `dashboards` | Acciones sobre dashboards (configurar, abrir, filtrar) | `WIDGET_DASHBOARD` / `NAVIGATION_CARD` |
| `integrations` | Activar/desactivar/correr integraciones, ver runs | `SUCCESS_CARD` / `DATA_TABLE` |
| `people` | Consultas sobre empleados (read-only en MVP) | `DATA_TABLE` / `EMPLOYEE_CARD` |
| `security` | Roles, permisos, usuarios | `SUCCESS_CARD` |
| `navigation` | Buscar y navegar a secciones de la app | `NAVIGATION_CARD` |
| `ai` | Configurar LLM provider por tenant, ver costos | `SUCCESS_CARD` |

#### Paso 5 — Tools de lectura asociadas

Cuando un CRUD genera un módulo completo, registrar también las **queries** (`getAll`, `getById`) como tools para que el agente pueda **leer antes de mutar**.

### 9.3 Ejemplo completo de Tool Definition

```typescript
{
  name: "create_integration",
  displayName: "Crear Integración",
  description: "Crea una nueva configuración de integración para el tenant activo. Úsala cuando el usuario diga 'agregar integración', 'conectar Manú', 'conectar Geovictoria' o similar.",
  category: "config",
  type: "mutation",
  requiredPermission: { resource: "integrations", action: "create" },
  actionFile: "apps/cliente/server-actions/integrations.ts",
  functionName: "createTenantIntegration",
  parameters: {
    type: "object",
    properties: {
      templateId:  { type: "number", description: "ID del template de integración del catálogo" },
      name:        { type: "string", description: "Nombre amigable para identificar esta integración" },
      cronSchedule: { type: "string", description: "Expresión cron (opcional, solo para scheduled)" },
      config:      { type: "object", description: "Configuración específica (mapping, filtros, etc.)" }
    },
    required: ["templateId", "name"]
  },
  uiResponse: "SUCCESS_CARD"
}
```

### 9.4 Errores frecuentes a evitar

- ⛔ Usar `name` como label de UI. `name` es el identificador técnico (snake_case) para el LLM. `displayName` es lo que ve el usuario.
- ⛔ Agregar parámetros que el backend resuelve solo (`tenantId`, `userId`).
- ⛔ Olvidar actualizar `tools.ts` cuando cambia el schema Zod de una acción existente. Las definiciones DEBEN estar siempre sincronizadas.

### 9.5 LLM provider para el agente del usuario

- El agente usa el provider configurado por tenant en Console (ver `03-arquitectura.md` §7 y `04-stack-tecnologico.md` §6): default Llama vía Groq/Together, alternativas Anthropic/OpenAI.
- Tracking en `ai_usage`: prompt, completion, tokens, costo, costo asignado al tenant.

### 9.6 Anti-alucinación y safety

- El agente solo puede ejecutar tools registradas en `tools.ts`. No "improvisa" SQL ni accede a datos directos.
- Si la tool pide parámetros que el agente no tiene claros, el chat repregunta antes de ejecutar.
- Mutations destructivas (`delete`, `cancel`) siempre con confirmación.
- Todas las invocaciones quedan auditadas en `sec_audit_log` igual que si las hubiera hecho un humano.

---

## 10. Migraciones y seeds

### SKILL 10: [PRISMA_SEED_AND_MIGRATE]

**Trigger:** cuando se defina una tabla nueva que requiera datos iniciales (catálogos) o se deba aplicar un cambio a la BD.

### 10.1 Reglas de migración

- Migraciones siempre con `npx prisma migrate dev --name <nombre_descriptivo>`. Crea automáticamente la carpeta `/prisma/migrations/`.
- Cada migración incluye, si aplica, las policies RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY; CREATE POLICY ...`) en SQL al final del archivo generado.
- Nunca editar migraciones aplicadas. Si hay error, generar una migración correctiva.

### 10.2 Reglas de seeding (modular e idempotente)

- ⛔ PROHIBIDO `prisma/seed.ts` monolítico.
- ✅ OBLIGATORIO: archivos en `/prisma/seeds/` con prefijo numérico:

  ```
  /prisma/seeds/
    01-cfg-tenant-statuses.ts
    02-cfg-contract-types.ts
    03-cfg-termination-reasons.ts
    04-sec-roles.ts
    05-sec-permissions.ts
    06-sec-role-permissions.ts
    07-int-templates.ts            // catálogo de integration templates
    08-dsh-templates.ts            // plantillas de dashboards People Analytics
    99-dev-demo-tenant.ts          // dev only, no se corre en prod
  ```

- Cada archivo exporta una función: `export async function seedTenantStatuses(prisma) { ... }`.
- Inserciones DEBEN usar `upsert` o `createMany` con `skipDuplicates: true`. **100% idempotentes**.
- `/prisma/seed.ts` solo actúa como **orquestador**: importa y ejecuta los scripts de `/seeds/`.

### 10.3 Regla crítica — tablas de navegación

- ⛔ PROHIBIDO crear o ejecutar scripts de seed para `nav_menu` y `nav_reports`.
- Estos datos los gestiona **manualmente** el DBA / administrador.
- Los seeds quedan reservados EXCLUSIVAMENTE para catálogos estáticos del sistema (`cfg_*`, `sec_roles`, `sec_permissions`, `int_templates` del catálogo, `dsh_templates`).

### 10.4 Invalidación de caché tras cambios manuales en nav_menu

- `getGlobalMenu()` usa `unstable_cache` con tag `global-menu` (ver SKILL 11). Los cambios manuales en BD NO se reflejan automáticamente.
- Después de modificar `nav_menu` manualmente:
  1. **Reiniciar el server** (`Ctrl+C` + `pnpm dev`) en desarrollo.
  2. **POST a `/api/admin/revalidate-menu`** (autenticado) en producción.
- El agente / desarrollador NUNCA debe asumir que el menú está actualizado sin haber invalidado el caché previamente.

### 10.5 Errores frecuentes a evitar

- ⛔ Seed que no es idempotente (rompe la segunda corrida).
- ⛔ Seed que toca `nav_menu`.
- ⛔ Editar una migración ya aplicada en prod.

---

## 11. Caché y performance

### SKILL 11: [PERFORMANCE_CACHE_STRATEGY]

**Trigger:** cuando se creen consultas de lectura (GET) para catálogos, configuraciones transversales, menús o cualquier query repetida en una misma request.

### 11.1 Reglas

1. **Datos estáticos globales**: usar `unstable_cache` de Next.js. Definir siempre un **tag claro**.

   ```ts
   import { unstable_cache } from "next/cache";

   export const getCatalogContractTypes = unstable_cache(
     async () => prisma.cfgContractType.findMany({ where: { deletedAt: null } }),
     ["cfg-contract-types"],
     { tags: ["cfg-catalogs"], revalidate: 3600 }
   );
   ```

2. **Revalidación**: toda Server Action de mutación (Create/Update/Delete) sobre estas tablas DEBE finalizar llamando a `revalidateTag('<tag>')`:

   ```ts
   "use server";
   import { revalidateTag } from "next/cache";

   export async function createContractType(input: unknown) {
     // ... lógica
     revalidateTag("cfg-catalogs");
     return { ok: true };
   }
   ```

3. **Deduplicación en request**: para consultas que se repiten múltiples veces en la misma vista o layout (verificar permisos del usuario actual, leer el tenant context), envolver en `React.cache(async () => { ... })`:

   ```ts
   import { cache } from "react";

   export const getCurrentUser = cache(async () => {
     // se ejecuta una sola vez por request aunque se llame N veces
   });
   ```

### 11.2 Tags estándar a registrar

| Tag | Qué invalida |
|---|---|
| `cfg-catalogs` | Cualquier mutación en tablas `cfg_*` |
| `global-menu` | Cambios manuales en `nav_menu` |
| `tenant-<tenantId>-integrations` | Mutaciones en `int_tenant_integrations` |
| `tenant-<tenantId>-dashboards` | Mutaciones en `dsh_configs` por tenant |
| `tenant-<tenantId>-people` | Mutaciones / cargas nuevas en `hr_people` |

### 11.3 Anti-patterns

- ⛔ Cachear queries que dependen del tenant sin incluir el `tenantId` en el cache key (riesgo de cross-tenant leak).
- ⛔ Olvidar `revalidateTag` después de una mutación → datos viejos hasta que expire el TTL.
- ⛔ Aplicar cache a queries que cambian a cada segundo (logs, métricas en vivo). No usar cache.

---

## 12. Auditoría (detalle)

### 12.1 Qué se audita

| Categoría | Ejemplos |
|---|---|
| Auth | Login (ok/falla), logout, password reset, invitaciones, revocación |
| Acceso cross-tenant (Console) | Internal user lee/modifica data de un tenant |
| Configuración crítica | Activar/desactivar modelos, cambiar reglas de integración, permisos, config de LLM |
| Acciones CRUD sensibles | Crear/editar/borrar usuarios, roles, integraciones, dashboards configurados |
| Ejecuciones manuales | Run now de integraciones, reset de cursor incremental, export masivo |
| Eventos del sistema | Snapshot mensual de `hr_people_history`, fallo de integración crítica |
| Invocaciones del agente | Cada tool ejecutada por el LLM user-facing (con prompt + parámetros + resultado) |

### 12.2 Tabla `sec_audit_log`

```
sec_audit_log
├─ id (uuid pk)                   ← UUID por volumen y porque no se referencia
├─ tenant_id (int, nullable)      ← null = evento global / Console cross-tenant
├─ actor_id (int)
├─ actor_type (enum: user / internal_user / system / agent)
├─ action (varchar)               ← p.ej. 'int_tenant_integration.update'
├─ target_type (varchar)
├─ target_id (varchar, nullable)
├─ payload_before (jsonb, nullable)
├─ payload_after (jsonb, nullable)
├─ payload_diff (jsonb, nullable)
├─ context (jsonb)                ← ip, user_agent, request_id, ai_session_id
├─ created_at (timestamptz)

índice (tenant_id, created_at desc)
índice (actor_id, created_at desc)
índice (action, created_at desc)
```

**Append-only**: triggers SQL impiden UPDATE y DELETE en runtime. Solo INSERT.

### 12.3 Wrapper estándar

```ts
// packages/auth/audit.ts
await audit({
  action: "int_tenant_integration.update",
  targetType: "int_tenant_integration",
  targetId: integration.id,
  before: prevConfig,
  after: newConfig,
});
```

- Las Server Actions de CRUD invocan este wrapper automáticamente vía higher-order helper.
- Eventos de sistema (snapshots, jobs cron) emiten desde el job runner.
- Invocaciones del agente: el helper de ejecución de tools registra cada call en `sec_audit_log` con `actor_type = 'agent'` y `ai_session_id` en el context.

### 12.4 Consulta y visualización

- **Console**: vista `/audit` con filtros (tenant, actor, action, rango). Exportable a CSV.
- **Cliente** (v1.x+): vista para admin del tenant con su propio audit, filtrado al tenant.

### 12.5 Retención

- MVP: retención indefinida (volumen bajo).
- v1.x+: política configurable por contrato (default 24 meses), archive a object storage si excede.

---

## 13. Decisiones tomadas en esta fase (consolidadas)

| # | Decisión | Estado |
|---|---|---|
| D-080 | Naming BD: snake_case plural tablas, snake_case columnas, prefijos `is_`/`has_` para booleanos | ✅ Cerrada |
| D-081 | PK `id Int @id @default(autoincrement())` salvo seguridad/logs (UUID); FK `<entidad>_id`; timestamps `created_at`/`updated_at`/`deleted_at` | ✅ Cerrada |
| D-082 | Política proactiva de índices con `tenant_id` como primer campo en compuestos | ✅ Cerrada |
| D-083 | Diccionario de datos vive en `/docs/database/wla_schema.dbml` con DBML + notas; Prisma sincronizado con `///` | ✅ Cerrada |
| D-084 | Sistema de diseño shadcn + Tailwind con tokens en `globals.css` (basado en AI-GEO-platform) | ✅ Cerrada |
| D-085 | Paleta: sidebar oscuro (`#2c3238`), topbar gris (`#363d43`), primary azul WinLabs (hex a confirmar) | ✅ Cerrada |
| D-086 | Tipografía Arial/Helvetica (alineado con AI-GEO); iconografía Lucide React exclusiva | ✅ Cerrada |
| D-087 | Sidebar colapsable + topbar + project switcher + user menu (patrón AI-GEO) | ✅ Cerrada |
| D-088 | Estados visuales estándar: skeletons / Loader scanner / EmptyState / banner / toasts | ✅ Cerrada |
| D-089 | Template CRUD enterprise B2B: PageHeader sin breadcrumbs duplicados, Exportar (XLSX+PDF) obligatorio, Herramientas obligatorio, Crear; DataTable server-side; Dialog para forms | ✅ Cerrada |
| D-090 | CLAUDE.md en raíz + skills propias en `.claude/skills/` (add-table, add-crud, add-integration, add-dashboard, add-ai-tool) | ✅ Cerrada |
| D-091 | Prompts al LLM ensamblados desde plantillas controladas; sin PII detallada al LLM | ✅ Cerrada |
| D-092 | `sec_audit_log` append-only con triggers SQL que impiden UPDATE/DELETE | ✅ Cerrada |
| D-093 | Wrapper `audit()` invocado automáticamente desde Server Actions de CRUD | ✅ Cerrada |
| D-094 | Vista de auditoría en Console (cross-tenant) y en Cliente (sólo del tenant, v1.x+) | ✅ Cerrada |
| **D-095** | **ORM: Prisma (no Drizzle), alineado con AI-GEO-platform y Kaivia. Actualiza recomendación de `04-stack-tecnologico.md` §3.2** | ✅ Cerrada |
| D-096 | Taxonomía de prefijos: `sec_`, `wla_`, `hr_`, `att_`, `pay_`, `int_`, `dsh_`, `ai_`, `nav_`, `cfg_` | ✅ Cerrada |
| D-097 | SKILL 6 [GENERATE_DOCUMENTATION] con estructura obligatoria; docs en `/docs/modules/` o `/docs/architecture/` | ✅ Cerrada |
| D-098 | SKILL 7 [CMP_DB_MODELING] obligatorio: DBML primero, Prisma después, notas en ambos | ✅ Cerrada |
| D-099 | SKILL 9 [AI_AGENT_TOOLING_INTEGRATION]: cada Server Action expone tool en `packages/ai/tools.ts`; `tenantId`/`userId` NUNCA como parámetro | ✅ Cerrada |
| D-100 | SKILL 10 [PRISMA_SEED_AND_MIGRATE]: seeds modulares idempotentes en `/prisma/seeds/`; PROHIBIDO seedear `nav_menu`/`nav_reports` | ✅ Cerrada |
| D-101 | SKILL 11 [PERFORMANCE_CACHE_STRATEGY]: `unstable_cache` con tags + `revalidateTag` post-mutación + `React.cache` para dedupe por request | ✅ Cerrada |
| D-102 | Criterios de implementación con Claude Code: 6 etapas (objetivo / archivos / implementar / validar / documentar / continuar); anti-patterns explícitos | ✅ Cerrada |
| D-103 | Sidebar default state: **colapsado** (alineado con AI-GEO-platform) | ✅ Cerrada |
| D-104 | Forms de CRUD en `<Dialog>` (modal central); `<Sheet>` no se usa para CRUDs estándar | ✅ Cerrada |
| D-105 | Auditoría también captura invocaciones del agente LLM (actor_type='agent', ai_session_id en context) | ✅ Cerrada |

---

## 14. Decisiones abiertas

- **Hex exacto del azul WinLabs** (paleta primary). Mientras tanto, placeholder `#1d4ed8`.
- **Logo / marca visual** del producto (icono cuadrado tipo "WL").
- **Subdomain vs path-based** para tenants — bloquea middleware.
- **Política de retención de `sec_audit_log`** — default 24 meses post-MVP.
- **Lista exacta de tools del agente para el MVP** — se va llenando feature por feature al codear.

---

## 15. Próximos pasos

→ Pasamos a **Cierre (Fase 7)**: crear `proyecto/README.md` como índice maestro navegable y `proyecto/DECISIONS.md` consolidando todas las decisiones tomadas (D-001 a D-105). También actualizar `04-stack-tecnologico.md` para reflejar D-095 (Prisma en lugar de Drizzle) y `03-arquitectura.md` si hace falta.
