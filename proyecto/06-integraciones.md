# 06 - Integraciones

> Documento de Fase 4 (parte 2). Define los workflows de integración del MVP: patrón general, integraciones específicas (file-based + Manú + Geovictoria), reglas configurables, reconciliación de identidades, manejo de errores y observabilidad.
> Última actualización: 2026-05-19.
> Modelo de datos al que apuntan: ver `05-modelo-datos.md`.

---

## 1. Resumen ejecutivo

Una **integración** en wlA es un workflow que toma data de una fuente externa y la persiste en el modelo canónico del tenant, aplicando reglas configurables en cada etapa.

**Tres integraciones en el MVP:**

1. **File-based genérico** (XLS / CSV / JSON) — upload manual desde UI Cliente o cron + watched folder (v1.x).
2. **API Manú** — sincronización scheduled de empleados, áreas, contratos.
3. **API Geovictoria** — sincronización scheduled de marcaciones / time & attendance.

Todas siguen el mismo patrón **Extract → Transform → Load → Notify**, orquestado por Trigger.dev (tentativo, ver Fase 3).

---

## 2. Patrón general (Extract → Transform → Load → Notify)

```
┌─────────────────────────────────────────────────────────────┐
│  TRIGGER  (cron / manual / webhook / upload)                │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  EXTRACT                                                     │
│  - Lee la fuente (archivo, API, etc.)                       │
│  - Obtiene records crudos                                    │
│  - Maneja paginación, rate-limit, retries                   │
│  - Reglas configurables: filtros de fecha, columnas, etc.   │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  TRANSFORM                                                   │
│  - Mapea campos source → canónico (config por tenant)       │
│  - Aplica reglas de limpieza / normalización                │
│  - Valida (Zod) cada record antes de persistir              │
│  - Identifica registros nuevos vs existentes                │
│  - Reglas configurables: descartes, mapeos, transformaciones│
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  LOAD                                                        │
│  - Upsert en tablas canónicas (people, time_daily, etc.)    │
│  - Transacción atómica con SET LOCAL tenant_id (RLS)        │
│  - Soft-update: no sobrescribe `custom_fields` que ya tienen│
│    valores no provenientes de la fuente                     │
│  - Marca origen con `source_integration_id`                 │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  NOTIFY                                                      │
│  - Registra `integration_runs` con métricas (rows, errores) │
│  - Si falla: alerta interna (Slack) + email admin tenant    │
│  - Si OK con warnings: log al detalle de run                │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Idempotencia

Todos los workflows son **idempotentes**: correr 2 veces produce el mismo resultado. Se logra con upserts basados en claves naturales (`employee_code` por tenant, `date + person_id` para `time_daily`, etc.).

### 2.2 Incremental vs full refresh

- **Incremental** (default): el job recuerda la última corrida exitosa y procesa solo deltas (filtra por `updated_at` o cursor de la API).
- **Full refresh**: forzable desde Console o UI Cliente. Útil para reconciliación o reparación.
- Cada integración declara qué soporta.

---

## 3. Catálogo de integraciones (MVP)

| Integration template | Modelos que pobla | Trigger soportados | Estado MVP |
|---|---|---|---|
| File: People (XLS/CSV/JSON) | people, areas, positions, locations | Upload manual / Cron+SFTP* / Run now | ✅ |
| File: Time & Attendance | time_daily | Upload manual / Cron+SFTP* / Run now | ✅ |
| File: Absenteeism | absenteeism_events, absenteeism_types | Upload manual / Cron+SFTP* / Run now | ✅ |
| File: Payroll | payroll_periods, payroll_entries, payroll_concepts | Upload manual / Cron+SFTP* / Run now | ✅ |
| API Manú | people, areas, positions, locations + payroll básico | Cron + Run now | ✅ |
| API Geovictoria | time_daily, absenteeism_events (parcial) | Cron + Run now | ✅ |

\* SFTP / watched folder: modelo de datos preparado, implementación de poller diferida a v1.x.

---

## 4. Integración: File-based (genérico)

### 4.1 Casos de uso

- Cliente ancla quiere subir un Excel mensual de payroll.
- PyME sin integración API exporta XLS de su sistema y lo sube.
- One-off histórico (carga inicial de 24 meses).

### 4.2 Formatos soportados (MVP)

- **XLSX** (Excel 2007+). Librería: `xlsx` (SheetJS) o `exceljs` para casos complejos.
- **CSV** (comma-separated, UTF-8). Librería: `papaparse`.
- **JSON** (array de objetos). Nativo.

### 4.3 Flow

1. **Upload**: usuario sube archivo en UI Cliente → archivo va a Supabase Storage (con `tenant_id` en el path).
2. **Validación inicial**: tamaño, formato, primera fila como headers, encoding.
3. **Mapping**: el tenant tiene configurado un **mapping** en Console:
   - "columna 'Codigo' → `employee_code`"
   - "columna 'Estado' → `status` con mapping `Activo=active, Inactivo=inactive`"
   - "columnas no mapeadas → `custom_fields.{nombre_columna}`"
4. **Transform**: aplica el mapping + reglas (filtros: "descartar tipo de contrato X").
5. **Load**: upsert por `employee_code` (clave natural por tenant).
6. **Notify**: muestra resumen en UI: "Procesadas 500 filas, 480 actualizadas, 20 nuevas, 0 errores".

### 4.4 Reglas configurables (en Console)

- **Mapping de columnas** (source → canónico).
- **Mapping de valores** (enum source → enum canónico, ej: "Activo / Inactivo / Licencia" → status).
- **Filtros pre-load** (descartar filas que cumplen un criterio).
- **Default values** (si una columna source es nula, qué valor canónico usar).
- **Validaciones extra** (formato de fecha esperado, regex de employee_code).

### 4.5 Manejo de errores en upload

- Validaciones soft: filas con errores se loguean al detalle del run pero NO bloquean el resto.
- Validaciones hard (estructura del archivo inválida, sin tenant_id, etc.): el run falla completo, sin escribir nada.
- Reporte descargable: CSV con filas fallidas + razón.

### 4.6 SFTP / Email / Watched folder (preparado, NO MVP)

- Modelo: tabla `integration_sources` con tipo `sftp` / `email` / `gdrive` + credenciales encriptadas (Supabase Vault).
- Poller (Trigger.dev cron cada N minutos) revisa fuentes activas, baja nuevos archivos, dispara el workflow file-based como si fueran uploads.
- **No se implementa en MVP**; sí se diseñan las tablas para que en v1.x se enchufen sin migración mayor.

---

## 5. Integración: API Manú

### 5.1 Qué nos da Manú (hipótesis a confirmar)

A confirmar con docs reales de Manú. Hipótesis razonable basada en lo típico de SaaS HR:

- Endpoint de empleados con: código, nombre, datos personales, área, posición, fecha de alta/baja, contrato, estado.
- Endpoint de áreas / estructura organizacional.
- Endpoint de posiciones / cargos.
- Posible endpoint de remuneración / payroll básico.
- Auth: API key o OAuth2 (a confirmar).
- Paginación: cursor o offset (a confirmar).
- Rate limits: a confirmar.

### 5.2 Mapeo source → canónico (hipótesis)

| Manú | wlA canónico |
|---|---|
| `employee_id` o `code` | `people.employee_code` |
| `first_name`, `last_name` | `people.first_name`, `people.last_name` |
| `email` | `people.email` |
| `hire_date` | `people.hire_date` |
| `termination_date` | `people.termination_date` |
| `area_code` | `people.area_id` (vía lookup en `areas`) |
| `position_code` | `people.position_id` (vía lookup en `positions`) |
| Campos no mapeables a canónico | `people.custom_fields` |

### 5.3 Flow

1. **Cron** (frecuencia configurable por tenant, default diario).
2. **Extract**: paginar todos los endpoints relevantes desde el último cursor exitoso. Reintentos exponenciales.
3. **Transform**: mapping standard de Manú a canónico. Reglas tenant-specific se aplican (filtros, mapeos custom).
4. **Reconciliación de identidades**: cada `employee_code` se busca en `people`. Si existe → update; si no → insert (con `source = 'manu'`).
5. **Load**: transacción con RLS aplicada.
6. **Snapshot mensual**: si la corrida es del día 1 del mes, dispara también el job de snapshot de `people_history`.
7. **Notify**.

### 5.4 Reglas configurables específicas Manú

- Filtros por estado, contrato, área (descartar empleados que no se quieren analytizar).
- Override de campos (forzar valor canónico aunque venga distinto).
- Mapping de áreas Manú → estructura de áreas wlA del tenant (si difieren).

### 5.5 Decisiones abiertas Manú

- **Documentación API**: necesitamos acceso oficial antes de implementar.
- **Sandbox**: ¿hay entorno de test o usamos el de producción del cliente ancla?
- **Webhooks**: ¿Manú soporta push de cambios o solo pull?
- **Auth model**: API key vs OAuth — define cómo se guardan credenciales.

---

## 6. Integración: API Geovictoria

### 6.1 Qué nos da Geovictoria (hipótesis a confirmar)

Geovictoria es un sistema de control de asistencia. Hipótesis:

- Endpoint de marcaciones (clock-in/out) por persona y fecha.
- Endpoint de ausencias / licencias.
- Endpoint de empleados (espejo del HR pero podría tener inconsistencias).
- Endpoint de horarios programados.
- Auth y paginación a confirmar.

### 6.2 Mapeo source → canónico (hipótesis)

Geovictoria entrega **eventos** (marcaciones). wlA modela **agregado diario** (`time_daily`). Hay que **agregar en el transform**:

| Cálculo | Cómo |
|---|---|
| `worked_hours` | sum(clock_out - clock_in) del día (manejando turnos partidos) |
| `overtime_hours` | max(0, worked_hours - scheduled_hours) según calendario laboral |
| `absent_hours` | max(0, scheduled_hours - worked_hours) si no hay justificación |
| `has_absence` | true si hay evento de ausentismo activo |

Para **ausentismos**: Geovictoria entrega registros de licencias que mapeamos a `absenteeism_events`.

### 6.3 Flow

1. **Cron** (frecuencia: típicamente diario, configurable).
2. **Extract**: pull de marcaciones desde el último cursor exitoso. Filtrar por rango de fechas si la API lo permite.
3. **Transform**:
   a. Mapeo de `employee_id_geo → people.id` (reconciliación, ver §7).
   b. Agregación de marcaciones a `time_daily` por persona × día.
   c. Mapeo de licencias a `absenteeism_events`.
4. **Load**: upsert en `time_daily` (clave `tenant_id + person_id + date`) y `absenteeism_events`.
5. **Notify**.

### 6.4 Reglas configurables específicas Geovictoria

- **Calendario laboral**: cómo determinar `scheduled_hours` por persona × día (turno fijo, rotativo, por área).
- **Política de tolerancia**: ¿llegadas tarde de <X minutos cuentan como ausencia o no?
- **Filtros**: descartar tipos de marcación de ciertas categorías.

### 6.5 Decisiones abiertas Geovictoria

- **Documentación API**: idem Manú, necesitamos acceso oficial.
- **Calendarios laborales**: ¿Geovictoria provee scheduled_hours o tenemos que modelarlo en wlA?
- **Empleados duplicados/desincronizados** entre Manú y Geovictoria — ver §7.

---

## 7. Reconciliación de identidades entre fuentes

**Problema:** una persona puede existir en Manú (HR) y en Geovictoria (T&A). Si los `employee_code` coinciden, todo bien. Si no, hay que reconciliar.

### 7.1 Estrategia

1. **Source of truth canónico**: declarar en Console **qué fuente** es la "source of truth" para crear personas (típicamente Manú/HR). Otras fuentes solo pueden hacer match contra esa.
2. **Tabla `people_source_ids`** que mapea:
   ```
   people_source_ids
   ├─ tenant_id, person_id (fk people), source (enum: manu/geovictoria/file/...), source_id (varchar)
      índice único (tenant_id, source, source_id)
   ```
3. **Matching automático**: cuando Geovictoria entrega un empleado, se busca primero en `people_source_ids` (source=geovictoria). Si no está, se intenta match por `employee_code`, `email` o `document_number`.
4. **Matching manual**: si no hay match automático, se crea un **incidente** que aparece en UI Cliente (lista de "personas no reconciliadas") y un admin del tenant resuelve manualmente eligiendo a qué `person_id` apuntar.
5. **Auto-create opt-in**: el tenant puede configurar "si Geovictoria trae personas no encontradas, crearlas automáticamente como `people` nuevos". Útil si Geovictoria también es source of truth secundaria.

### 7.2 Métricas de salud de reconciliación

En UI Cliente: panel que muestra cuántas personas tiene cada fuente, cuántas matchean, cuántas no.

---

## 8. Esquema de configuración por tenant (resumen)

Tabla `tenant_integrations` (ya en `05-modelo-datos.md`):

```
tenant_integrations
├─ id
├─ tenant_id
├─ template_id (fk integration_templates)
├─ name (nombre amigable, configurable)
├─ status (active/paused/error)
├─ schedule_cron (nullable, si es scheduled)
├─ config (jsonb)  ← todas las reglas y mappings
├─ credentials_id (fk a tabla encriptada con Supabase Vault)
├─ last_run_at, last_success_at
├─ created_at, updated_at
```

El campo `config (jsonb)` tiene una estructura por tipo de template (validada con JSON Schema):

```json
{
  "mapping": {
    "employee_id": "people.employee_code",
    "first_name": "people.first_name",
    ...
  },
  "value_mapping": {
    "status": { "Activo": "active", "Inactivo": "inactive" }
  },
  "filters": [
    { "field": "contract_type", "op": "not_in", "value": ["temporal"] }
  ],
  "defaults": { "country": "AR" },
  "extra_validations": { ... }
}
```

---

## 9. Manejo de errores y observabilidad

### 9.1 Niveles de error

| Nivel | Ejemplo | Acción |
|---|---|---|
| **Fatal** | Credenciales API inválidas; archivo corrupto; BD inaccesible | Run aborta, alerta interna + email admin tenant |
| **Run-failure** | API responde 500 después de N reintentos | Run aborta, retries automáticos siguientes |
| **Row-error** | Una fila no valida (campo requerido vacío, formato incorrecto) | Se loguea al detalle del run, se descarta esa fila, el run continúa |
| **Warning** | Reconciliación pendiente, campo mapeado pero no estándar | Se loguea, se sigue |

### 9.2 Tabla `integration_runs`

Ya definida en Fase 3. Cada run guarda:
- start/end timestamps
- status (running, success, partial, failed)
- counts (read, transformed, loaded, errors, warnings)
- error_log (JSON con detalles)
- trigger_source (cron/manual/upload)
- triggered_by (user_id o 'system')

### 9.3 Observabilidad en UI

**Cliente:**
- Settings → Integraciones → ver lista, status, última corrida.
- Click en una integración → historial de runs + detalle de cada uno.
- Botón "Run now" + botón "Reset incremental cursor" (para forzar full refresh).

**Console:**
- Vista cross-tenant de integraciones, filtrable por status.
- Alerta si un tenant tiene >N runs fallados consecutivos.

---

## 10. Plan de implementación (alto nivel, dentro del MVP)

Sugerencia de orden (a refinar en Fase 5 / Roadmap):

1. **Spine + Console mínima + Auth** (mes 1-2).
2. **Framework de integraciones**: tablas, runner, UI básica (mes 2-3).
3. **File-based People** (mes 3): el más simple, valida el framework.
4. **File-based Time, Absenteeism, Payroll** (mes 3-4): se reutiliza el framework.
5. **API Manú** (mes 4): primera integración API.
6. **API Geovictoria** (mes 5): segunda API, valida reconciliación.
7. **Polish + cliente ancla en producción** (mes 6).

---

## 11. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-047 | Patrón Extract → Transform → Load → Notify para toda integración | ✅ Cerrada |
| D-048 | Idempotencia obligatoria; incremental por default, full refresh forzable | ✅ Cerrada |
| D-049 | Catálogo MVP: File-based (4 templates) + API Manú + API Geovictoria | ✅ Cerrada |
| D-050 | Reglas configurables por tenant: mapping, value mapping, filtros, defaults, validaciones | ✅ Cerrada |
| D-051 | Reconciliación de identidades vía `people_source_ids` + matching manual cuando no hay auto | ✅ Cerrada |
| D-052 | Almacenamiento de credenciales en Supabase Vault (encriptado) | ✅ Cerrada |
| D-053 | Niveles de error: fatal / run-failure / row-error / warning | ✅ Cerrada |
| D-054 | `integration_runs` como tabla canónica de observabilidad de integraciones | ✅ Cerrada |
| D-055 | SFTP/Email watched folder: tablas preparadas, implementación diferida a v1.x | ✅ Cerrada |

---

## 12. Decisiones abiertas

- **APIs Manú y Geovictoria**: confirmar documentación, sandbox, modelo de auth, paginación, rate limits, webhooks. Necesario antes de empezar a codear las APIs.
- **Calendario laboral**: ¿modelo en wlA propio, o se confía 100% en Geovictoria? Define complejidad de cálculo de `scheduled_hours` y por ende `overtime`.
- **Costos**: si vienen pre-calculados de las fuentes (Payroll) o se derivan en wlA (cantidad × tarifa estándar).
- **Carga inicial histórica**: ¿se hace con file-based one-off o se desarrolla un modo "bulk historical" para Manú/Geovictoria?

---

## 13. Próximos pasos

→ Pasamos a **Fase 5: Roadmap general** — `07-roadmap.md`.

Sintetizamos todo lo definido en Fases 1-4 en un roadmap Now / Next / Later con sprints / milestones / dependencias, separado por área (Spine, Cliente, Console, Integraciones, IA).
