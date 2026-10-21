# Runbook: deploy con migraciones y worker

**Fecha:** 2026-10-14
**Cuándo usarlo:** cualquier cambio que incluya una migración de base de datos **y** cambios en `jobs/worker/`, o catálogo nuevo (templates, tipos de unidad, motivos de baja).

Si el cambio es solo de las apps (sin migraciones ni worker), alcanza con el push: Vercel despliega solo.

## Por qué importa el orden
- Vercel **aplica las migraciones en el build** (`db:migrate:deploy && turbo build`) apenas se hace push a `main`.
- El worker en Fly **no se actualiza solo**: sigue corriendo el código viejo hasta el `fly deploy`.
- Entre ambos momentos existe una **ventana de riesgo**: si la migración cambió algo que el worker usa (columnas, restricciones), el worker viejo falla al cargar archivos. Las apps y el CMP no se ven afectados.

## Antes del push
1. **Backup de Supabase** (la migración es lo único difícil de revertir). Anotá la hora.
2. Verificar en local: `pnpm --filter @wla/cliente typecheck`, `@wla/cmp`, `@wla/db`, `@wla/worker` (y `pnpm --filter @wla/worker build`).
3. Probar el flujo completo en local si cambió la carga de archivos (ver `prueba-local-de-archivos.md`).
4. Avisar a quienes usen el entorno que **no suban archivos** durante el deploy.
5. Revisar qué entra al commit: no incluir `apps/cmp/tsconfig.tsbuildinfo` ni archivos `.env`.

## Deploy
1. **Push a `main`.** Seguir el build de Vercel: la migración corre ahí. En paralelo corre el CI (tests RLS, con un rol sin privilegios de superusuario).
2. **`fly deploy` enseguida**, desde `jobs/worker/`:
   ```bash
   cd jobs/worker
   fly deploy
   fly logs
   ```
   En los logs tienen que aparecer `WLA worker starting`, `processor loop started` y `snapshot loop started`. Unos 30 segundos después, `snapshots: cierre generado` por cada tenant que tenga personas y no tenga cierres.
3. **Catálogo** (si se agregaron templates, tipos o motivos): `pnpm --filter @wla/db db:seed:prod-catalog`. Es idempotente y no borra nada. Tiene que ir **antes** de crear las integraciones de un template nuevo.
4. **Limpieza de datos de prueba** (solo si hace falta recargar desde cero): ver `limpieza-de-datos-de-tenant.md`. Siempre en simulación primero.
5. **Integraciones nuevas:** crear en el CMP la integración del template nuevo para cada tenant.
6. **Recargar archivos** en este orden: Personas, Historial de unidades, Asistencia, Ausentismo, Liquidaciones.

## Verificación
- La pantalla de cada integración muestra el job completado y, si corresponde, los errores por fila.
- `/headcount` muestra el mes de cierre esperado, los KPIs coherentes con el archivo y todas las dimensiones.
- El CMP lista los templates nuevos en Templates.
- Excel y PDF se descargan.

## Si algo sale mal
- **Falla la migración en el build de Vercel:** Prisma deja la migración marcada como fallida y los deploys siguientes quedan trabados. La app anterior sigue sirviendo. Corregir el problema y resolverlo con `prisma migrate resolve --rolled-back <nombre>` (con la URL de producción) antes de reintentar; si dejó la base a medias, restaurar el backup.
- **El CI falla por una extensión (`btree_gist`):** es una extensión "de confianza" en PostgreSQL 13 o superior; verificar que el rol de CI tenga `CREATE` sobre la base.
- **El worker nuevo no arranca:** revisar `fly logs` y los secretos (`fly secrets list`). Para volver a una versión anterior: `fly releases --image` lista las imágenes y `fly deploy --image <imagen>` redespliega una de ellas. Ojo: volver atrás el worker no revierte la migración, y el código viejo puede no ser compatible con el esquema nuevo.
- **Fly avisa de un problema en el host ("Host Hardware Maintenance") o el worker no responde:** el worker no usa volúmenes, así que se mueve a un host sano sin perder datos (los jobs pendientes viven en la base). Ver [Fly: host unavailable](https://docs.fly.io/apps/trouble-host-unavailable). Pasos:
  1. `fly status` y `fly machine list` (desde `jobs/worker/`) para ver si la máquina está `started`, `stopped` o inalcanzable; la pestaña Status del dashboard de Fly muestra los problemas de host que afectan la app.
  2. Si hace falta mover la máquina: `fly scale count 0` y luego `fly scale count 1` (o `fly deploy`) crea una máquina nueva en un host sano. Escalar a cero reinicia el tamaño a shared-cpu-1x / 256 MB: pasar el tamaño que usa el worker (`--vm-size`, `--vm-memory`) o confirmar con `fly scale show`.
  3. Si el host original vuelve, la máquina vieja puede reaparecer con una versión anterior: destruirla con `fly machine destroy <id>`. Dos workers a la vez no corrompen nada (los jobs se toman con `FOR UPDATE SKIP LOCKED`), pero el viejo ejecutaría código desactualizado.
  4. Después de recuperar, `fly logs` y verificar que un job de prueba pase de `pending` a `completed`. Un job que estaba en curso se re-agenda solo (recovery de 15 min).
  5. Para el próximo deploy con un host dudoso: hacer `fly deploy` y, si queda "lease not found" o la máquina nueva no arranca, aplicar los pasos 1 a 3 antes de reintentar. Conviene tener 2 máquinas en la región para que un host caído no frene las cargas.
- **Un job quedó en `retry_scheduled` con un archivo viejo:** si reprocesarlo pisaría datos nuevos, marcarlo como fallido en la tabla `jobs`.

## Notas de entorno (Windows)
- El `fly` se actualiza solo la primera vez que se corre una versión nueva. Ese reemplazo del ejecutable puede disparar una alerta heurística del antivirus (`PDM:Trojan.Win32.Generic` sobre `flyctl.exe.old`): es un falso positivo conocido. Reinstalar con `iwr https://fly.io/install.ps1 -useb | iex`, agregar una exclusión solo para `%USERPROFILE%\.fly\bin` y desactivar la auto-actualización con `fly settings autoupdate disable`.

## Changelog
| Fecha | Cambio |
|---|---|
| 2026-10-14 | Versión inicial |
