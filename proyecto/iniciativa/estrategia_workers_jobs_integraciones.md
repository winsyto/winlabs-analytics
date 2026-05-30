# Estrategia de arquitectura para procesos pesados, integraciones y jobs programados

## 1. Objetivo del documento

Este documento define una estrategia técnica reutilizable para proyectos que requieren ejecutar procesos críticos, largos o de gran volumen, especialmente integraciones de datos, sincronizaciones, procesos batch, cálculos diferidos, importaciones, transformaciones y operaciones programadas.

La estrategia está pensada para proyectos con una arquitectura base compuesta por:

```txt
Next.js en Vercel
Supabase Postgres
VPS con Docker
Worker scheduler + worker processor
Tablas jobs / job_runs / job_events / checkpoints
```

Y una evolución futura hacia:

```txt
Scheduler
Queue / jobs
Processors escalables en Azure Container Apps Jobs
```

La premisa principal es separar claramente:

- la interfaz web;
- la base transaccional;
- la programación de tareas;
- la ejecución pesada;
- la auditoría;
- la recuperación ante fallos;
- la escalabilidad futura.

---

## 2. Principio arquitectónico central

Los procesos pesados no deben ejecutarse dentro de Next.js, Vercel Functions, Supabase Edge Functions ni directamente dentro de la base de datos como lógica intensiva.

La regla principal es:

```txt
Next.js = interfaz y operación
Supabase Postgres = estado transaccional y auditoría
VPS / Worker = procesamiento pesado
Jobs table / Queue = desacople entre solicitud y ejecución
```

Esto permite que la aplicación sea más robusta, observable y escalable.

---

## 3. Arquitectura inicial recomendada

```txt
┌─────────────────────────────┐
│ Next.js en Vercel            │
│ UI / Backoffice / Dashboard  │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│ Supabase Postgres            │
│ Datos + jobs + auditoría     │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│ VPS con Docker               │
│ Scheduler + Processor        │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       ↓                ↓
┌─────────────┐   ┌─────────────┐
│ APIs externas│   │ Archivos     │
│ ERP/HR/BI/etc│   │ CSV/JSON/XML │
└──────┬──────┘   └──────┬──────┘
       ↓                 ↓
┌─────────────────────────────┐
│ Transformación / Validación  │
│ Normalización / Upsert       │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Supabase Postgres / Storage  │
│ Resultados + logs + métricas │
└─────────────────────────────┘
```

---

## 4. Responsabilidades por componente

| Componente | Responsabilidad principal |
|---|---|
| Next.js / Vercel | Interfaz web, configuración, dashboards, operación manual, visualización de logs y estados |
| Supabase Postgres | Base transaccional, configuración de integraciones, jobs, auditoría, checkpoints, estados |
| VPS con Docker | Ejecución de procesos pesados, scheduler liviano, workers, integraciones externas |
| Worker Scheduler | Detectar tareas vencidas y crear jobs pendientes |
| Worker Processor | Tomar jobs pendientes, bloquearlos, procesarlos, registrar avance y resultado |
| Jobs table / Queue | Desacoplar el pedido de ejecución del procesamiento real |
| Job Runs | Registrar cada intento de ejecución |
| Job Events | Registrar eventos técnicos y funcionales del proceso |
| Checkpoints | Guardar último punto exitoso para procesamiento incremental |
| Storage | Guardar archivos fuente, archivos procesados, reportes, outputs y evidencias |

---

## 5. Flujo general de procesamiento

```txt
1. Un usuario configura una integración desde Next.js.
2. La configuración se guarda en Supabase.
3. El Worker Scheduler corre cada X minutos en el VPS.
4. El Scheduler revisa integration_schedules.
5. Si una integración está vencida, crea un job en estado pending.
6. El Worker Processor toma jobs pending.
7. El Processor bloquea el job usando un mecanismo de locking.
8. Ejecuta la integración por lotes.
9. Actualiza progreso, logs y checkpoints.
10. Si finaliza correctamente, marca el job como completed.
11. Si falla, registra error y agenda retry o marca failed.
12. El usuario ve el estado desde el dashboard de Next.js.
```

---

## 6. Modelo de ejecución recomendado

El VPS puede correr dos procesos separados o un único servicio con dos loops internos.

### Opción A: dos servicios separados

```txt
worker-scheduler
worker-processor
```

Ventajas:

- separación clara de responsabilidades;
- mejor control operativo;
- logs separados;
- escalabilidad más simple en el futuro.

### Opción B: un solo servicio con dos loops

```txt
worker-service
  ├── scheduler loop
  └── processor loop
```

Ventajas:

- más simple para comenzar;
- menor complejidad operativa;
- ideal para una primera versión controlada.

Recomendación inicial:

```txt
Comenzar con un único servicio Docker con dos loops internos.
Separarlo más adelante si crece el volumen o la criticidad.
```

---

## 7. Modelo sugerido de tablas

El siguiente esquema es conceptual y puede adaptarse por proyecto.

---

## 7.1 Tabla `integrations`

Define cada integración configurada para un cliente, tenant o proyecto.

```sql
create table public.integrations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,

  name text not null,
  description text,

  integration_type text not null,
  provider text,

  enabled boolean not null default true,

  config jsonb not null default '{}'::jsonb,
  credentials_ref text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Ejemplos de `integration_type`:

```txt
api_pull
api_push
file_import
file_export
database_sync
webhook_consumer
report_generation
payroll_import
attendance_sync
analytics_sync
```

Ejemplos de `provider`:

```txt
external_hr_system
jira
google_analytics
custom_api
ftp_server
sftp_server
legacy_database
internal_system
```

---

## 7.2 Tabla `integration_schedules`

Define cuándo debe ejecutarse cada integración.

```sql
create table public.integration_schedules (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  integration_id uuid not null references public.integrations(id),

  enabled boolean not null default true,

  schedule_type text not null,
  frequency text,
  cron_expression text,
  timezone text not null default 'America/Argentina/Buenos_Aires',

  next_run_at timestamptz not null,
  last_run_at timestamptz,

  lock_until timestamptz,
  locked_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Ejemplos de `schedule_type`:

```txt
manual
interval
cron
event_driven
```

Ejemplos de `frequency`:

```txt
every_5_minutes
every_15_minutes
hourly
daily
weekly
monthly
```

Recomendación inicial:

```txt
Usar frecuencias controladas en lugar de cron_expression libre.
Agregar cron_expression custom cuando exista una necesidad real.
```

---

## 7.3 Tabla `jobs`

Representa una unidad de trabajo pendiente, en ejecución o finalizada.

```sql
create table public.jobs (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  integration_id uuid references public.integrations(id),
  schedule_id uuid references public.integration_schedules(id),

  job_type text not null,
  status text not null default 'pending',
  priority int not null default 0,

  run_key text,

  payload jsonb not null default '{}'::jsonb,
  result jsonb,

  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,

  attempts int not null default 0,
  max_attempts int not null default 3,
  next_retry_at timestamptz,

  locked_at timestamptz,
  locked_by text,
  heartbeat_at timestamptz,

  progress_current int not null default 0,
  progress_total int not null default 0,
  progress_message text,

  last_error text,
  last_error_code text,

  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Estados sugeridos:

```txt
pending
claimed
running
partially_completed
completed
failed
retry_scheduled
cancelled
expired
```

Índices sugeridos:

```sql
create index jobs_status_scheduled_idx
on public.jobs (status, scheduled_at);

create index jobs_tenant_status_idx
on public.jobs (tenant_id, status);

create index jobs_integration_idx
on public.jobs (integration_id);

create unique index jobs_unique_run_key_idx
on public.jobs (tenant_id, integration_id, job_type, run_key)
where run_key is not null;
```

La columna `run_key` es fundamental para evitar duplicados.

Ejemplos de `run_key`:

```txt
integration:123:2026-05-26T10:00
integration:123:2026-05-26T10:05
integration:456:2026-05-26
manual-import:file-abc-123
```

---

## 7.4 Tabla `job_runs`

Registra cada intento concreto de ejecución de un job.

```sql
create table public.job_runs (
  id uuid primary key default gen_random_uuid(),

  job_id uuid not null references public.jobs(id),
  tenant_id uuid not null,

  worker_id text not null,
  status text not null,

  started_at timestamptz not null default now(),
  finished_at timestamptz,

  duration_ms bigint,

  processed_count int not null default 0,
  success_count int not null default 0,
  failed_count int not null default 0,
  skipped_count int not null default 0,

  error_message text,
  error_code text,

  metadata jsonb not null default '{}'::jsonb
);
```

Estados sugeridos para `job_runs`:

```txt
running
completed
failed
cancelled
timeout
worker_shutdown
```

---

## 7.5 Tabla `job_events`

Registra eventos técnicos y funcionales ocurridos durante el ciclo de vida del job.

```sql
create table public.job_events (
  id bigserial primary key,

  job_id uuid not null references public.jobs(id),
  job_run_id uuid references public.job_runs(id),
  tenant_id uuid not null,

  event_type text not null,
  level text not null default 'info',

  message text,
  data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);
```

Ejemplos de `event_type`:

```txt
job_created
job_claimed
job_started
batch_started
batch_completed
checkpoint_updated
external_api_called
external_api_error
validation_error
retry_scheduled
job_completed
job_failed
job_cancelled
```

Ejemplos de `level`:

```txt
debug
info
warning
error
critical
```

Índice sugerido:

```sql
create index job_events_job_created_idx
on public.job_events (job_id, created_at desc);

create index job_events_tenant_created_idx
on public.job_events (tenant_id, created_at desc);
```

---

## 7.6 Tabla `integration_checkpoints`

Guarda el último punto exitoso de una integración para permitir procesamiento incremental.

```sql
create table public.integration_checkpoints (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  integration_id uuid not null references public.integrations(id),

  checkpoint_type text not null,
  checkpoint_value text,
  checkpoint_data jsonb not null default '{}'::jsonb,

  last_success_at timestamptz,
  last_attempt_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, integration_id, checkpoint_type)
);
```

Ejemplos de `checkpoint_type`:

```txt
last_external_id
last_updated_at
last_file_processed
last_page_token
last_batch_number
last_successful_period
```

Ejemplos de valores:

```txt
last_external_id = 982371
last_updated_at = 2026-05-26T10:00:00Z
last_file_processed = payroll_20260526.csv
last_page_token = abc123
last_successful_period = 2026-05
```

---

## 7.7 Tabla `integration_batches`

Opcional pero muy útil para procesos de gran volumen.

```sql
create table public.integration_batches (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  integration_id uuid not null references public.integrations(id),
  job_id uuid not null references public.jobs(id),

  batch_number int not null,
  status text not null default 'pending',

  source_ref text,
  record_count int not null default 0,
  processed_count int not null default 0,
  failed_count int not null default 0,

  started_at timestamptz,
  finished_at timestamptz,

  error_message text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (job_id, batch_number)
);
```

Estados sugeridos:

```txt
pending
running
completed
failed
skipped
retry_scheduled
```

---

## 7.8 Tablas de staging

Para integraciones masivas, se recomienda no insertar directamente en las tablas finales.

Modelo general:

```txt
raw_import_batches
raw_import_rows
staging_<entity>
final_<entity>
```

Ejemplo genérico:

```sql
create table public.raw_import_batches (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  integration_id uuid not null references public.integrations(id),
  job_id uuid references public.jobs(id),

  source_type text not null,
  source_ref text,

  status text not null default 'received',

  total_rows int not null default 0,
  valid_rows int not null default 0,
  invalid_rows int not null default 0,

  created_at timestamptz not null default now(),
  processed_at timestamptz
);
```

```sql
create table public.raw_import_rows (
  id bigserial primary key,

  batch_id uuid not null references public.raw_import_batches(id),
  tenant_id uuid not null,

  row_number int,
  raw_data jsonb not null,

  status text not null default 'pending',
  validation_errors jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);
```

Este patrón permite:

- auditar qué llegó;
- validar antes de impactar datos finales;
- reprocesar;
- comparar diferencias;
- detectar errores de origen;
- generar reportes de calidad de datos.

---

## 8. Mecanismo de scheduling inicial

En la etapa inicial, el scheduling vive dentro del VPS.

```txt
VPS Worker Scheduler
   ↓
Cada X minutos ejecuta enqueue_due_integrations()
   ↓
Crea jobs pending
```

El scheduler debe:

1. buscar schedules habilitados;
2. detectar `next_run_at <= now()`;
3. bloquear temporalmente el schedule;
4. crear un job con `run_key` único;
5. calcular el próximo `next_run_at`;
6. liberar el lock;
7. registrar evento.

---

## 9. Mecanismo de locking para schedules

Para evitar que dos schedulers creen jobs duplicados:

```sql
with due_schedules as (
  select id
  from public.integration_schedules
  where enabled = true
    and next_run_at <= now()
    and (lock_until is null or lock_until < now())
  order by next_run_at asc
  limit 50
  for update skip locked
)
update public.integration_schedules s
set
  lock_until = now() + interval '2 minutes',
  locked_by = 'scheduler-01',
  updated_at = now()
from due_schedules d
where s.id = d.id
returning s.*;
```

Luego el scheduler crea los jobs correspondientes.

---

## 10. Mecanismo de locking para jobs

El Worker Processor debe tomar jobs de forma segura usando `FOR UPDATE SKIP LOCKED`.

```sql
with next_job as (
  select id
  from public.jobs
  where status in ('pending', 'retry_scheduled')
    and scheduled_at <= now()
    and (next_retry_at is null or next_retry_at <= now())
  order by priority desc, scheduled_at asc
  limit 1
  for update skip locked
)
update public.jobs j
set
  status = 'running',
  locked_at = now(),
  locked_by = 'worker-01',
  heartbeat_at = now(),
  attempts = attempts + 1,
  started_at = coalesce(started_at, now()),
  updated_at = now()
from next_job
where j.id = next_job.id
returning j.*;
```

Este patrón permite correr varios workers en paralelo sin procesar el mismo job dos veces.

---

## 11. Heartbeat y recuperación de jobs colgados

El worker debe actualizar periódicamente el heartbeat del job.

```sql
update public.jobs
set
  heartbeat_at = now(),
  progress_current = $1,
  progress_total = $2,
  progress_message = $3,
  updated_at = now()
where id = $4;
```

Un proceso de recuperación debe detectar jobs colgados:

```sql
update public.jobs
set
  status = case
    when attempts < max_attempts then 'retry_scheduled'
    else 'failed'
  end,
  next_retry_at = case
    when attempts < max_attempts then now() + interval '10 minutes'
    else null
  end,
  locked_at = null,
  locked_by = null,
  last_error = 'Job heartbeat expired',
  updated_at = now()
where status = 'running'
  and heartbeat_at < now() - interval '15 minutes';
```

---

## 12. Idempotencia

Todos los jobs deben ser idempotentes.

Un job idempotente puede ejecutarse más de una vez sin generar datos duplicados, efectos secundarios incorrectos ni inconsistencias.

Ejemplos:

```txt
Si un registro externo ya fue importado, hacer update y no insert duplicado.
Si un archivo ya fue procesado, no procesarlo nuevamente.
Si una notificación ya fue enviada, no reenviarla salvo que corresponda.
Si un período ya fue calculado, recalcular con versión o reemplazo controlado.
```

Mecanismos recomendados:

- `run_key` único por ejecución lógica;
- constraints únicas por entidad externa;
- upserts;
- checkpoints;
- tablas de staging;
- marcas de procesamiento por batch;
- logs de efectos externos;
- deduplicación por hash de payload o archivo.

---

## 13. Reintentos

Los reintentos deben manejarse de forma explícita.

Estrategia simple:

```txt
Intento 1: inmediato
Intento 2: +5 minutos
Intento 3: +15 minutos
Intento 4: +1 hora
Luego: failed
```

Ejemplo conceptual:

```txt
next_retry_at = now() + retry_delay(attempts)
```

Tabla lógica:

| attempts | delay sugerido |
|---:|---|
| 1 | 5 minutos |
| 2 | 15 minutos |
| 3 | 1 hora |
| 4 | 6 horas |

Los errores deben clasificarse.

Ejemplos:

```txt
transient_network_error → retry
rate_limit_error → retry con backoff mayor
authentication_error → failed, requiere intervención
validation_error → failed o partially_completed
external_system_down → retry
invalid_payload → failed
```

---

## 14. Procesamiento por lotes

Para grandes volúmenes, no se debe procesar todo como una única transacción grande.

Patrón recomendado:

```txt
Job principal
   ↓
Batch 1: 0 - 5.000 registros
Batch 2: 5.001 - 10.000 registros
Batch 3: 10.001 - 15.000 registros
...
```

Cada batch debe:

1. leer un conjunto acotado de datos;
2. validar;
3. transformar;
4. persistir en staging o final;
5. actualizar checkpoint;
6. registrar métricas;
7. confirmar estado del batch.

Tamaños sugeridos iniciales:

```txt
1.000 a 5.000 registros por batch para APIs externas.
5.000 a 25.000 registros por batch para CSV/archivos locales.
Depende de memoria, latencia, tamaño de payload y complejidad de transformación.
```

---

## 15. Integraciones soportadas

La arquitectura puede soportar distintos mecanismos de integración.

---

## 15.1 API Pull

El worker consulta una API externa periódicamente.

```txt
Scheduler crea job
Worker consulta API externa
Worker pagina resultados
Worker transforma
Worker upsertea
Worker actualiza checkpoint
```

Checkpoints típicos:

```txt
last_updated_at
last_external_id
page_token
cursor
```

---

## 15.2 API Push

El sistema envía datos hacia una API externa.

```txt
Evento interno crea job
Worker arma payload
Worker envía a API externa
Worker registra respuesta
Worker actualiza estado
```

Consideraciones:

- registrar request y response resumidos;
- guardar correlation id externo;
- manejar rate limits;
- evitar duplicados con idempotency keys.

---

## 15.3 File Import

Importación de archivos CSV, JSON, XML, XLSX u otros.

```txt
Archivo llega a Storage / SFTP / upload manual
Se crea raw_import_batch
Se crea job de procesamiento
Worker lee archivo
Worker genera raw_import_rows
Worker valida
Worker transforma
Worker impacta datos finales
```

Recomendación:

```txt
Nunca impactar datos finales directamente desde el archivo.
Usar staging y validaciones previas.
```

---

## 15.4 Database Sync

Sincronización contra otra base de datos.

```txt
Worker conecta a base externa
Lee cambios incrementales
Guarda staging
Aplica upserts
Actualiza checkpoint
```

Consideraciones:

- conexiones seguras;
- IP allowlist;
- usuario read-only cuando sea posible;
- batches;
- control de locks;
- timezone y tipos de datos.

---

## 15.5 Webhook Consumer

Cuando un sistema externo notifica cambios.

```txt
Webhook recibe evento
Guarda evento crudo
Crea job pending
Worker procesa evento
```

Recomendación:

```txt
El webhook no debe procesar pesado.
Solo validar, guardar y encolar.
```

---

## 16. Seguridad

### 16.1 Service role key

El worker externo puede usar la `SUPABASE_SERVICE_ROLE_KEY`, pero solo en ambientes backend seguros.

Nunca debe exponerse en:

```txt
frontend
Next.js client components
navegador
repositorio Git
logs
responses públicas
```

### 16.2 Secrets

En la etapa VPS:

```txt
.env del contenedor
Docker secrets si aplica
archivos protegidos
permisos mínimos
```

En etapa Azure:

```txt
Azure Key Vault
Managed Identity
Container Apps secrets
```

### 16.3 Acceso a Supabase

Recomendaciones:

- usar RLS para la aplicación web;
- usar service role solo para workers controlados;
- separar credenciales por ambiente;
- auditar operaciones sensibles;
- restringir IPs si el plan/infraestructura lo permite;
- rotar claves periódicamente.

---

## 17. Observabilidad mínima

Desde el inicio, el sistema debe permitir responder:

```txt
¿Qué proceso está corriendo?
¿Qué proceso falló?
Qué cliente fue afectado?
Cuántos registros se procesaron?
Cuántos registros fallaron?
Cuál fue el último error?
Cuándo fue la última ejecución exitosa?
Hay jobs trabados?
Cuánto demora cada integración?
```

Métricas mínimas:

```txt
jobs pending
jobs running
jobs failed
jobs completed por día
promedio de duración
cantidad de registros procesados
cantidad de errores por proveedor
tiempo desde último éxito por integración
workers activos
heartbeats recientes
```

Alertas mínimas:

```txt
Job failed crítico
Job running sin heartbeat
Integración sin ejecución exitosa en X tiempo
Cantidad de errores superior a umbral
Cola de pending jobs creciendo
Worker caído
```

---

## 18. Dashboard operativo en Next.js

El dashboard debería incluir:

### Vista general

```txt
Jobs pendientes
Jobs en ejecución
Jobs fallidos
Últimas ejecuciones
Integraciones activas
Integraciones con error
```

### Vista por integración

```txt
Configuración
Última ejecución
Próxima ejecución
Último checkpoint
Historial de jobs
Errores recientes
Volumen procesado
```

### Vista por job

```txt
Estado
Payload
Progreso
Intentos
Worker asignado
Heartbeat
Eventos
Errores
Batches
Resultado
```

### Acciones manuales

```txt
Ejecutar ahora
Cancelar job
Reintentar job
Pausar integración
Reactivar integración
Reprocesar desde checkpoint
Reprocesar archivo
```

---

## 19. Docker en VPS

Estructura inicial sugerida:

```txt
/worker
  Dockerfile
  docker-compose.yml
  src/
    index.ts
    scheduler.ts
    processor.ts
    db.ts
    integrations/
      apiPull.ts
      fileImport.ts
      databaseSync.ts
    jobs/
      claimJob.ts
      completeJob.ts
      failJob.ts
      heartbeat.ts
    utils/
      logger.ts
      retry.ts
      checkpoints.ts
```

Ejemplo conceptual de `docker-compose.yml`:

```yaml
services:
  worker:
    build: .
    container_name: integration-worker
    restart: unless-stopped
    env_file:
      - .env
    environment:
      WORKER_ID: worker-vps-01
      SCHEDULER_ENABLED: "true"
      PROCESSOR_ENABLED: "true"
      SCHEDULER_INTERVAL_SECONDS: "60"
      PROCESSOR_POLL_INTERVAL_SECONDS: "10"
```

Variables sugeridas:

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WORKER_ID=worker-vps-01
SCHEDULER_ENABLED=true
PROCESSOR_ENABLED=true
SCHEDULER_INTERVAL_SECONDS=60
PROCESSOR_POLL_INTERVAL_SECONDS=10
JOB_HEARTBEAT_SECONDS=30
MAX_CONCURRENT_JOBS=2
```

---

## 20. Lógica del scheduler

Pseudocódigo:

```txt
loop every SCHEDULER_INTERVAL_SECONDS:
  schedules = claim_due_schedules(limit=50)

  for each schedule:
    run_key = build_run_key(schedule)

    create job if not exists:
      tenant_id
      integration_id
      schedule_id
      job_type
      run_key
      payload
      scheduled_at

    update schedule:
      last_run_at
      next_run_at
      unlock

    create job_event: job_created
```

Reglas:

- no crear duplicados;
- usar `run_key`;
- calcular `next_run_at` de forma determinística;
- registrar errores;
- si falla la creación del job, liberar lock o marcar error;
- no procesar datos en el scheduler.

---

## 21. Lógica del processor

Pseudocódigo:

```txt
loop every PROCESSOR_POLL_INTERVAL_SECONDS:
  if active_jobs >= MAX_CONCURRENT_JOBS:
    continue

  job = claim_next_job()

  if no job:
    continue

  create job_run

  try:
    start heartbeat loop
    process job by job_type
    update checkpoints
    mark job completed
    mark job_run completed
    create job_event job_completed
  catch error:
    classify error
    if retryable and attempts < max_attempts:
      mark retry_scheduled
    else:
      mark failed
    mark job_run failed
    create job_event job_failed
  finally:
    stop heartbeat loop
```

---

## 22. Migración futura a Azure Container Apps Jobs

Cuando el volumen crezca, se puede evolucionar hacia:

```txt
Scheduler
Queue / jobs
Processors escalables
Azure Container Apps Jobs
```

Arquitectura futura:

```txt
┌─────────────────────────────┐
│ Next.js / Vercel             │
│ UI + operación               │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Supabase Postgres            │
│ jobs + estado + auditoría    │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Scheduler                    │
│ VPS / Azure / Container Job  │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Queue / jobs                 │
│ Supabase table / PGMQ /      │
│ Azure Service Bus            │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Azure Container Apps Jobs    │
│ processors escalables        │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ Supabase / Storage / APIs    │
└─────────────────────────────┘
```

---

## 23. Estrategia de migración gradual

### Fase 1: VPS simple

```txt
Un contenedor worker
Scheduler loop
Processor loop
Jobs table en Supabase
```

Objetivo:

```txt
Validar modelo, jobs, checkpoints, logs y patrones de integración.
```

### Fase 2: separación de procesos

```txt
worker-scheduler
worker-processor
```

Objetivo:

```txt
Separar responsabilidades y mejorar operación.
```

### Fase 3: múltiples processors

```txt
worker-scheduler
worker-processor-01
worker-processor-02
worker-processor-03
```

Objetivo:

```txt
Aumentar throughput usando locking con SKIP LOCKED.
```

### Fase 4: Azure Container Apps Jobs

```txt
Scheduler crea jobs
Azure Container Apps Jobs procesa lotes
Supabase centraliza estado
```

Objetivo:

```txt
Escalabilidad, menor administración de servidor y mejor operación cloud.
```

### Fase 5: Queue dedicada

```txt
Azure Service Bus / PGMQ / Redis Queue / RabbitMQ
Processors escalables
Dead Letter Queue
```

Objetivo:

```txt
Mayor robustez, retries avanzados, backpressure y DLQ formal.
```

---

## 24. Cuándo migrar a Azure Container Apps Jobs

Señales de migración:

```txt
El VPS queda chico de CPU o memoria.
Se necesitan múltiples workers por demanda.
Hay ventanas de procesamiento con picos fuertes.
Se requiere mejor aislamiento por tipo de job.
Se necesita operación más profesional.
Se requiere integración con Azure Monitor y Key Vault.
Se necesita escalar horizontalmente sin administrar servidores.
```

No migrar demasiado temprano si:

```txt
El volumen todavía es bajo.
El modelo de jobs no está validado.
Los tipos de integración cambian mucho.
Todavía no hay métricas claras de carga.
El costo y la simplicidad son prioritarios.
```

---

## 25. Decisiones de diseño recomendadas

### 25.1 Usar jobs table desde el inicio

Aunque al principio haya pocos procesos, usar una tabla de jobs evita acoplar la ejecución directamente a la UI o a endpoints HTTP.

### 25.2 No procesar pesado en API Routes

Las API Routes deben:

```txt
crear jobs
consultar estado
cancelar jobs
reintentar jobs
mostrar logs
```

No deben:

```txt
procesar miles de registros
transformar archivos grandes
ejecutar integraciones largas
mantener procesos vivos
```

### 25.3 Usar checkpoints siempre

Toda integración incremental debe tener checkpoint.

### 25.4 Registrar eventos, no solo estado final

El estado final no alcanza para diagnosticar problemas.

### 25.5 Diseñar para reintentos desde el día uno

Los fallos de red, timeouts, APIs externas caídas y rate limits son normales.

### 25.6 Diseñar para idempotencia

Todo proceso crítico debe tolerar reejecución.

---

## 26. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Worker caído | restart policy, heartbeat, alertas, dashboard |
| Job duplicado | `run_key`, constraints únicas, idempotencia |
| Job colgado | heartbeat + recovery task |
| API externa caída | retries con backoff, clasificación de errores |
| Gran volumen inesperado | batches, límites, paginación, checkpoints |
| Saturación de Supabase | batches, índices, evitar transacciones enormes, monitoreo |
| Datos inválidos | staging tables, validaciones, reportes de errores |
| Credenciales expuestas | secrets backend, Key Vault futuro, no exponer service role |
| Falta de auditoría | job_runs + job_events + raw imports |
| Costos crecientes | métricas por job, batch size, control de frecuencia |

---

## 27. Recomendación final

La arquitectura inicial recomendada es:

```txt
Next.js en Vercel
Supabase Postgres
VPS con Docker
Worker scheduler + worker processor
Tablas jobs/job_runs/job_events/checkpoints
```

Esta arquitectura permite:

- mantener bajo control los costos iniciales;
- evitar límites serverless;
- procesar integraciones largas;
- manejar grandes volúmenes por lotes;
- auditar el ciclo completo;
- reintentar fallos;
- retomar desde checkpoints;
- evolucionar naturalmente a workers escalables.

La evolución futura recomendada es:

```txt
Scheduler separado
Queue/jobs formal
Processors escalables
Azure Container Apps Jobs
Azure Key Vault
Azure Monitor
```

La idea principal debe mantenerse constante durante toda la evolución:

```txt
La app no procesa pesado.
La base conserva estado y auditoría.
El worker procesa.
La cola desacopla.
Los checkpoints permiten retomar.
La observabilidad permite operar.
```

---

## 28. Checklist para implementación futura

### Base de datos

- [ ] Crear tabla `integrations`
- [ ] Crear tabla `integration_schedules`
- [ ] Crear tabla `jobs`
- [ ] Crear tabla `job_runs`
- [ ] Crear tabla `job_events`
- [ ] Crear tabla `integration_checkpoints`
- [ ] Crear tablas de staging si aplica
- [ ] Crear índices principales
- [ ] Crear constraints de idempotencia
- [ ] Crear funciones RPC para claim/enqueue/update

### Worker

- [ ] Crear proyecto worker separado
- [ ] Crear Dockerfile
- [ ] Crear docker-compose
- [ ] Implementar scheduler loop
- [ ] Implementar processor loop
- [ ] Implementar heartbeat
- [ ] Implementar retries
- [ ] Implementar logging
- [ ] Implementar integración inicial
- [ ] Implementar shutdown graceful

### Next.js

- [ ] Crear dashboard de jobs
- [ ] Crear vista de integraciones
- [ ] Crear vista de job detail
- [ ] Crear acciones manuales
- [ ] Crear pantalla de errores
- [ ] Crear filtros por tenant, integración y estado

### Operación

- [ ] Configurar variables de entorno
- [ ] Configurar restart policy
- [ ] Configurar logs persistentes
- [ ] Configurar alertas básicas
- [ ] Configurar backups
- [ ] Documentar runbook de errores frecuentes

### Evolución Azure

- [ ] Containerizar processor de forma independiente
- [ ] Separar scheduler de processor
- [ ] Evaluar Azure Container Apps Jobs
- [ ] Evaluar Azure Key Vault
- [ ] Evaluar Azure Monitor
- [ ] Evaluar Azure Service Bus si el volumen lo justifica

---

## 29. Runbook operativo mínimo

### Job en estado `running` por demasiado tiempo

1. Revisar `heartbeat_at`.
2. Revisar `job_events`.
3. Revisar logs del worker.
4. Si no hay heartbeat reciente, marcar retry o failed.
5. Verificar si el proceso es idempotente antes de reintentar.

### Job falló

1. Revisar `last_error`.
2. Revisar `job_runs`.
3. Revisar `job_events`.
4. Clasificar error: transitorio o definitivo.
5. Reintentar si corresponde.
6. Si es error de datos, corregir origen o staging.

### Integración no corre

1. Revisar `integration_schedules.enabled`.
2. Revisar `next_run_at`.
3. Revisar scheduler activo.
4. Revisar locks vencidos.
5. Revisar si existen jobs duplicados bloqueados por `run_key`.

### Cola creciendo

1. Revisar cantidad de jobs pending.
2. Revisar capacidad del worker.
3. Aumentar concurrencia si es seguro.
4. Reducir batch size si hay fallos.
5. Evaluar workers adicionales.
6. Considerar migración a Azure Container Apps Jobs.

---

## 30. Notas finales

Esta estrategia está pensada para ser aplicada en más de un proyecto. Por eso se recomienda mantenerla como documento base y adaptarla según:

- volumen de datos;
- criticidad del proceso;
- frecuencia de ejecución;
- tipo de integración;
- requerimientos de auditoría;
- costos aceptables;
- nivel de operación disponible;
- roadmap de infraestructura.

El diseño permite empezar simple sin cerrar el camino hacia una arquitectura más profesional y escalable.

