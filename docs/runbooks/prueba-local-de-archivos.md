# Runbook: probar la carga de archivos en local

**Fecha:** 2026-10-14
**Cuándo usarlo:** antes de desplegar cambios en el worker, en los parsers o en la pantalla de Integraciones; o para probar los dashboards con datos de ejemplo.

## Preparación (una sola vez)

1. **Bucket de desarrollo en R2** (separado del de producción), por ejemplo `wl-analytics-dev`, y sus credenciales en `apps/cliente/.env.local` (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`).
2. **CORS del bucket de desarrollo** (sin esto la pantalla muestra "Error al subir el archivo"). En Cloudflare: R2, el bucket, Settings, CORS Policy, y pegar:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. **`jobs/worker/.env`** (ignorado por git) con la base local y las mismas credenciales de R2 del cliente:
   ```
   DATABASE_URL=<la misma que apps/cliente/.env.local>
   WORKER_ID=worker-local
   SCHEDULER_ENABLED=false
   PROCESSOR_ENABLED=true
   PROCESSOR_POLL_INTERVAL_SECONDS=3
   SNAPSHOTS_ENABLED=true
   R2_ENDPOINT=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=wl-analytics-dev
   ```
4. Base local migrada y con catálogo: `pnpm --filter @wla/db db:migrate:dev`. Si faltan templates o tipos de unidad en tu base local, el seed completo (`db:seed`) también recrea tenants de prueba; alternativa más acotada: `db:seed:demo-people` (carga motivos, tipos y datos demo en `acme`).

## Cada vez

1. Levantar todo:
   ```bash
   pnpm --filter @wla/cliente dev     # localhost:3000
   pnpm --filter @wla/cmp dev         # localhost:3001 (si hace falta administrar tenants)
   pnpm --filter @wla/worker dev      # worker en modo watch, lee jobs/worker/.env
   ```
2. En el CMP, asegurar que el tenant tenga las integraciones de los templates que se van a probar.
3. Limpiar datos previos del tenant si querés partir de cero:
   ```bash
   pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme            # simulación
   pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme --confirm  # ejecuta
   ```
4. Entrar a `localhost:3000` (tenant `acme`, `admin@acme.com`) y subir desde Integraciones, **en este orden**: Personas, Historial de unidades, Asistencia, Ausentismo, Liquidaciones. Los archivos de ejemplo se descargan de la propia pantalla.
5. Revisar el resultado de cada job en la pantalla de la integración y los dashboards.

## Qué esperar con los archivos de ejemplo
- **Personas:** 48 filas, 0 errores, 10 personas con baja; se generan 24 cierres mensuales.
- **Historial:** 18 filas aplicadas a 9 personas.
- Los números exactos del dashboard dependen de la fecha en que se carguen (los cierres son de los últimos 24 meses cerrados).
- Los archivos se regeneran con `npx tsx scripts/generate-examples.ts` desde `jobs/worker/` (escribe en `apps/cliente/public/examples/`).

## Problemas frecuentes
| Síntoma | Causa y solución |
|---|---|
| "Error al subir el archivo" en la pantalla | Falta la política CORS en el bucket de desarrollo (arriba) |
| El job queda en `pending` | El worker no está corriendo, o falta `jobs/worker/.env` |
| `invalid input syntax for type uuid: ""` | Una consulta a una tabla con RLS sin contexto de tenant; en local el rol sí aplica RLS. Usar `withTenantContext` (apps) o `withTenantClient` (worker) |
| Job `retry_scheduled` de un archivo viejo | Reintentos de intentos anteriores; marcarlos `failed` en `jobs` para que no reprocesen datos viejos |
| `The specified key does not exist` | El archivo está en otro bucket (se cambió el bucket después de subir) |
| `EPERM ... query_engine-windows.dll.node` al correr `prisma generate` | Windows bloquea el motor mientras hay servidores abiertos; cerrar los `dev` y repetir |
| Gráficos en blanco al probar con el navegador integrado | El panel pausa las animaciones si no está visible; no es un error de la app |

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-14 | Versión inicial |
