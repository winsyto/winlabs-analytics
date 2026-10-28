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
- **Aislamiento frente al CMP (D-146):** cookie de sesión propia (`wla-cliente.session-token`, con `__Secure-` en producción) y marca `app: "cliente"` en el token; una sesión sin la marca no vale. Cada app debe tener su propio `AUTH_SECRET`

## Rutas actuales

```
/login                          → LoginForm (tenantSlug + email + password)
/change-password                → Cambio obligatorio de contraseña (usuarios creados o reseteados desde el CMP)
/dashboard                      → Inicio: estado de los datos de cada fuente de archivo (último archivo, cobertura, al día o con errores)
/analytics                      → Hub de dashboards activos del tenant, agrupados por categoría (RRHH, Finanzas, Otras)
/data                           → Hub de Data: Integraciones manuales y Status de integraciones
/integration-status             → Status de integraciones automáticas (próximamente)
/headcount                      → Dashboard 1 (Headcount): KPIs, gráficos por dimensión, filtros
/headcount/[scope]/[[...id]]    → Drill-down: activos, altas, bajas, dim/<tipo>/<id>
/headcount/export               → Descarga Excel/PDF (?format=xlsx|pdf)
/integrations                   → Integraciones manuales (carga de archivos): lista de integraciones del tenant
/integrations/[id]              → Subida de archivo, columnas del template y resultados de cada job
/absenteeism                    → Dashboard 2 (Ausentismos): tasa vs meta, evolución, clase y tipo, tasa por dimensión
/absenteeism/[scope]/[[...id]]  → Drill-down: eventos, personas, clase/<código>, tipo/<código>, dim/<tipo>/<id>
/absenteeism/export             → Descarga Excel/PDF (?format=xlsx|pdf)
/absenteeism/reportes/fecha     → Resumen por fecha y unidad (dotación, presentismo y ausentismo por clase; ?from, ?to, ?g=<dimensión>)
/absenteeism/reportes/fecha/export → Excel/PDF del reporte
/absenteeism/reportes/tipos     → Cuadro por tipo de ausencia y unidad (índices por grupo y por empresa; ?g, ?m=events|days|hours, ?all=1 y los filtros del dashboard)
/absenteeism/reportes/tipos/export → Excel/PDF del cuadro
/overtime                       → Dashboard 3 (Horas extras): tasa vs meta, evolución, horas por tipo (no autorizadas aparte), tasa por dimensión
/overtime/[scope]/[[...id]]     → Drill-down: horas, personas (por horas de mayor a menor), tipo/<código>, dim/<tipo>/<id>
/overtime/export                → Descarga Excel/PDF (?format=xlsx|pdf)
/turnover                       → Dashboard 4 (Rotación): rotación vs meta anual prorrateada, voluntaria, bajas por categoría y motivo, bajas tempranas, evolución e ingresos/egresos, tasa por dimensión
/turnover/[scope]/[[...id]]     → Drill-down: bajas, tempranas, categoria/<código>, motivo/<código>, dim/<tipo>/<id>
/turnover/export                → Descarga Excel/PDF (?format=xlsx|pdf)
/payroll                        → Dashboard 5 (Payroll): masa salarial bruta, costo medio por persona, neto pagado, costo de horas extra, evolución de 12 meses, composición por clase, costo medio por dimensión (celdas de menos de 3 personas reservadas)
/payroll/[scope]/[[...id]]      → Drill-down: procesos, clase/<id o uncl>, dim/<tipo>/<id>, personas (solo admin)
/payroll/export                 → Descarga Excel/PDF (?format=xlsx|pdf)
/payroll/conceptos              → Detalle por concepto (botón del resumen): cuadro de conceptos o, con ?c=<id>, tarjetas, evolución, por proceso y por unidad de un concepto; personas solo admin
/payroll/conceptos/export       → Excel/PDF del cuadro o del concepto (?c=<id>&format=xlsx|pdf)
/reports                        → Hub de reportes (próximamente)
/settings                       → Hub de configuración agrupado (Seguridad y Básicas); solo muestra las opciones que aplican a los dashboards activos y avisa los pendientes
/settings/org-units             → Unidades organizativas (próximamente)
/settings/shifts                → Horario de cada unidad de tipo Turno (horas por día, semana laboral); sin horario propio usa el de la empresa
/settings/absence-types         → Clase de cada tipo de ausencia y si cuenta como ausentismo; avisa los tipos sin clasificar
/settings/time-entry-types      → Categoría de cada tipo de hora (regular, hora extra, hora extra no autorizada, etc.); avisa los tipos sin clasificar
/settings/payroll-concepts      → Conceptos de liquidación: pestaña Conceptos (tipo, clase puntual, cuál acumulador es el sueldo bruto y el neto; avisa los sin clasificar) y pestaña Clases (agregar, renombrar, lado haber o retención y los tipos que agrupa)
/settings/targets               → Metas por tenant (ausentismo 4% y horas extras 10% mensual; rotación 18% anual, prorrateada al período)
/settings/users                 → Gestión de usuarios del tenant (cambiar rol, activar/desactivar)
```

Documentación de los módulos: `docs/modules/dashboard-headcount.md`, `docs/modules/dashboard-ausentismo.md`, `docs/modules/dashboard-horas-extras.md`, `docs/modules/dashboard-rotacion.md`, `docs/modules/dashboard-payroll.md`, `docs/modules/carga-de-archivos.md`. Para agregar un dashboard: skill `ADD_DASHBOARD`.

## Permisos en settings

- `settings/shifts`, `settings/absence-types`, `settings/time-entry-types`, `settings/payroll-concepts` y `settings/targets`: solo `admin` edita (`assertCan(role, "edit", "settings")`); analyst y viewer los ven en solo lectura
- Helper del rol actual: `settings/_lib/role.ts`

## Permisos en settings/users

- Solo rol `admin` puede editar (cambiar rol, activar/desactivar)
- El rol se obtiene fresh desde BD en cada server action (no desde JWT)
- Un usuario no puede modificarse a sí mismo

## Notas

- Layout dashboard: `app/(dashboard)/layout.tsx` — fetchea nombre del tenant y los dashboards activos (hub de dashboards) para el sidebar
- Cada dashboard tiene un `layout.tsx` con `DashboardGuard` y sus rutas `export/route.ts` comprueban `isDashboardEnabled`: un dashboard apagado desde el CMP muestra "no habilitado" (ver `docs/modules/hub-de-dashboards.md`)
- `proxy.ts` protege todas las rutas salvo `/login`
- Server actions siempre verifican `session.user.id` antes de operar
