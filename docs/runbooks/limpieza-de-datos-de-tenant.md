# Runbook: limpieza de datos de un tenant

**Fecha:** 2026-10-14
**Cuándo usarlo:** para borrar los datos cargados por archivos (por ejemplo, datos de prueba) y volver a cargar desde cero, en local o en producción.

Script: `packages/db/src/scripts/cleanup-tenant-data.ts`.

## Qué borra y qué conserva

**Borra** los datos de dominio del tenant: asistencia (`att_time_daily` y sus entradas), eventos de ausentismo, liquidaciones (`pay_entries`, `pay_periods`, `pay_concepts`), tipos de ausentismo del tenant, cierres mensuales (`hr_people_history`), asignaciones de unidades, personas (`hr_people`) y unidades (`hr_org_units`).

**Conserva** el tenant, sus usuarios y roles, la configuración de tipos de unidad y de dimensiones, y las integraciones configuradas. El historial de ejecuciones (`jobs`, `job_runs`, `job_events`, `job_checkpoints`, `int_runs`, `int_run_errors`) **no** se borra salvo que se pase `--include-runs`.

## Uso

Siempre primero la **simulación** (es el comportamiento por defecto): lista cuántas filas se borrarían en cada tabla y no toca nada.

```bash
# Local
pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme                # simulación
pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme --confirm      # ejecuta

# Producción (usa packages/db/.env.production.local)
pnpm --filter @wla/db db:cleanup:tenant:prod -- --tenant=acme           # simulación
pnpm --filter @wla/db db:cleanup:tenant:prod -- --tenant=acme --confirm # ejecuta
```

Opciones: `--tenant=<slug>` (obligatoria), `--confirm` (sin esto no borra), `--include-runs` (también borra el historial de ejecuciones).

El script imprime la **base de datos de destino** (host y nombre) antes de actuar: leerlo siempre antes de agregar `--confirm`.

## Procedimiento en producción
1. Backup de Supabase.
2. Simulación y revisar las cantidades (¿coinciden con lo que esperás borrar?).
3. Ejecutar con `--confirm`.
4. Repetir para cada tenant con datos de prueba.
5. Recargar los archivos en el orden indicado en `deploy-migraciones-y-worker.md`.

## Notas
- Todo corre en una sola transacción: si algo falla, no se borra nada.
- Las cargas posteriores regeneran los cierres mensuales solas; hasta entonces los dashboards muestran el estado "sin datos".
- No borra tablas globales (catálogos).

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-14 | Versión inicial |
