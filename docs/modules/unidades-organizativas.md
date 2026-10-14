# Unidades organizativas, vigencias y dimensiones por tenant

**Fecha:** 2026-10-14
**Estado:** MVP

## Resumen

Describe cómo se modela la estructura de la empresa del cliente (empresa, sucursal, área, puesto, contrato, etc.) y su historia. Cada persona pertenece, **en cada momento**, a una unidad por tipo. Los tipos son un catálogo global de WinLabs; cada tenant elige cuáles usa y cuáles son las **dimensiones** de cada dashboard. Esa configuración decide qué columnas son obligatorias en el archivo de Personas y qué filtros y gráficos tiene el dashboard.

Reemplaza el diseño original (`area_id`, `position_id` y `location_id` fijos en `hr_people` y foto mensual como única historia). Decisiones: D-106 a D-111 en `proyecto/DECISIONS.md`.

## Arquitectura

### Tablas involucradas
- `cfg_org_unit_types` (global, sin RLS): catálogo de 15 tipos con `sort_order`.
- `hr_org_units` (RLS): unidades de cada tenant, únicas por (tipo, código). Tiene `unique (id, org_unit_type_code)` para la FK compuesta de las asignaciones.
- `hr_people_org_assignments` (RLS): **fuente de verdad de la historia**. Una fila = una persona en una unidad desde `valid_from` hasta `valid_to` (inclusive; nulo = vigente).
- `cfg_tenant_org_unit_types` (RLS): qué tipos usa el tenant (`is_enabled`).
- `dsh_dimensions` (RLS): qué tipos son dimensiones de cada dashboard (`dashboard_code`, hoy `headcount`) y en qué orden.
- `hr_people_history` (RLS): caché mensual derivado; guarda las unidades vigentes a fin de cada mes en `org_assignments_snapshot`.

### Garantías de la base de datos
- **Una unidad por persona y tipo en cada momento:** restricción de exclusión (`EXCLUDE USING gist` sobre `daterange(valid_from, valid_to, '[]')`, requiere la extensión `btree_gist`). No se pueden solapar vigencias.
- **Coherencia tipo/unidad:** FK compuesta `(org_unit_id, org_unit_type_code)` hacia `hr_org_units`.
- **Fechas válidas:** `CHECK (valid_to IS NULL OR valid_to >= valid_from)`.
- Prisma no modela las restricciones de exclusión: viven en el SQL de la migración.

### Catálogo de tipos
| Código | Nombre | Dimensión por defecto |
|---|---|---|
| `COMPANY` | Empresa | sí |
| `LOCATION` | Sucursal | sí |
| `AREA` | Área / sector | sí |
| `POSITION` | Puesto | sí |
| `CONTRACT` | Contrato | sí |
| `DEPARTMENT` | Departamento | |
| `COST_CENTER` | Centro de costos | |
| `MANAGEMENT` | Gerencia | |
| `CATEGORY` | Categoría | |
| `SHIFT` | Turno | |
| `UNION` | Sindicato | |
| `AGREEMENT` | Convenio | |
| `PAY_FREQUENCY` | Forma de liquidación | |
| `AGENCY` | Agencia | |
| `ART` | ART | |

La fuente en código es `ORG_UNIT_TYPES` en `packages/db/src/org-config.ts`; las migraciones y los seeds la repiten (idempotente).

### Archivos clave
- Configuración por defecto y catálogo: `packages/db/src/org-config.ts` (`ORG_UNIT_TYPES`, `DEFAULT_DIMENSION_TYPES`, `applyDefaultOrgConfig`).
- Administración en el CMP: `apps/cmp/app/(dashboard)/tenants/[tenantId]/_components/tenant-org-config-card.tsx` y `_actions/org-config.actions.ts`.
- Lectura en el dashboard: `apps/cliente/app/(dashboard)/headcount/_data/dimensions.ts`.
- Carga: `jobs/worker/src/handlers/filePeople/`, `fileOrgHistory/` y `shared/orgSchema.ts`, `shared/orgUnits.ts` (ver `carga-de-archivos.md`).
- Migraciones: `20261013000000_add_org_unit_history_and_dimensions`, `20261013000100_rename_org_assignments_validity_index`, `20261014000000_drop_hr_people_contract_type`.

## Configuración por tenant

- Al **crear un tenant** desde el CMP se aplica `applyDefaultOrgConfig`: los 5 tipos por defecto quedan habilitados y como dimensiones del headcount. Los demás tipos quedan deshabilitados.
- En el CMP (detalle del tenant) se pueden habilitar o deshabilitar tipos, agregar, quitar y reordenar dimensiones (máximo 6) y restaurar los valores por defecto.
- No se puede deshabilitar un tipo que es dimensión de un dashboard, ni usar como dimensión un tipo deshabilitado.
- Si un tenant no tiene dimensiones configuradas, el dashboard y el worker usan los 5 por defecto.

## Cómo se mantiene la historia

- **Alta de una persona** (archivo de Personas): se abre su unidad de cada tipo desde la fecha de ingreso.
- **Cambio de unidad detectado en una re-carga** de Personas: se cierra el período anterior el día previo a la carga y se abre el nuevo desde la fecha de carga (si el vigente empezó ese mismo día, se corrige en el lugar).
- **Archivo de Historial de unidades:** reemplaza, por persona y tipo, todo el historial con las fechas exactas. Es la forma de cargar el pasado.
- **Persona con baja:** el último período de cada tipo termina en la fecha de baja (se ajusta si la fecha cambia en una carga posterior).
- **Reincorporación** (se quita la fecha de baja): se abre un período nuevo desde el día siguiente al último cierre.
- Después de cada carga de Personas o de Historial se regeneran los cierres mensuales.

## Decisiones técnicas relevantes

- **Vigencias en una tabla propia (SCD tipo 2), no solo fotos mensuales:** permite historia exacta de cualquier unidad y cierres mensuales exactos; la foto mensual pasó a ser un caché.
- **Catálogo global y configuración por tenant:** el catálogo no cambia entre clientes; lo que varía es qué se usa y qué se muestra.
- **Contrato como unidad:** evita un segundo mecanismo para algo que tiene historia.
- **Multipuesto fuera de alcance:** una unidad por tipo en cada momento. Si hiciera falta, implica revisar toda la restricción de solapamiento.
- **La jerarquía de unidades (`parent_org_unit_id`) existe pero no se usa** todavía.

## Cómo extender

- **Nuevo tipo en el catálogo:** agregarlo a `ORG_UNIT_TYPES` (con `sortOrder`), crear una migración que lo inserte (idempotente) y correr `db:seed:prod-catalog`. Queda deshabilitado para los tenants hasta que se habilite en el CMP.
- **Usarlo como dimensión:** habilitarlo y agregarlo a las dimensiones del dashboard en el CMP. El archivo de Personas empieza a exigir `<tipo>_code` para ese tenant.
- **Multipuesto o jerarquías:** requieren un diseño aparte (ver Pendientes).

## Pendientes
- [ ] Hub de dashboards y gestión de dashboards activos por tenant, con permisos por opción de menú (ver `BACKLOG.md`).
- [ ] Usar la jerarquía de unidades (`parent_org_unit_id`) para agrupar y subtotalizar.
- [ ] Decidir si se admite multipuesto.
- [ ] Mostrar y administrar las unidades de cada tenant desde el CMP (hoy se crean al cargar archivos).

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-14 | Versión inicial |
