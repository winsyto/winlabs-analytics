# 05 - Modelo de datos

> Documento de Fase 4 (parte 1). Define el esquema canónico de los modelos del MVP (People + Time + Payroll), la estrategia de history, las métricas y dimensiones de los 4 dashboards.
> Última actualización: 2026-05-19.
> Integraciones (cómo llega la data): ver `06-integraciones.md`.

---

## 1. Resumen ejecutivo

El modelo de datos del MVP se compone de:

- **People** (empleados, áreas, posiciones, locations, jerarquía organizacional).
- **Time & Attendance** (agregado diario + eventos de ausentismo).
- **Payroll** (simplificado: ingresos por período + conceptos clave).
- **Reference tables** (catálogos por tenant: áreas, posiciones, tipos de ausentismo, etc.).
- **Snapshots mensuales** para reconstruir el estado histórico sin necesidad de SCD Type 2.

Todas las tablas con datos del tenant llevan `tenant_id uuid NOT NULL` y están bajo RLS. Las tablas core tienen esquema rígido + columna `custom_fields JSONB` para extensiones específicas por cliente.

---

## 2. Decisiones clave (resumen)

| Aspecto | Decisión |
|---|---|
| Granularidad T&A | **Daily aggregate + eventos de ausentismo** |
| History | **Snapshot mensual** (en v1.x evaluamos SCD2 para campos críticos si hace falta) |
| Customización por tenant | **Schema rígido + `custom_fields JSONB`** |
| Triggers de integración | **Cron + Upload manual + Trigger manual (MVP)**; SFTP/Email preparado en modelo, implementación diferida a v1.x |
| Período de datos | A definir, propuesta: **2 años hacia atrás + lo nuevo** (ver §7) |
| Tenant scope | RLS sobre todas las tablas de tenant, `tenant_id` en cada fila |

---

## 3. Esquema canónico (overview)

```
┌─────────────────────────────────────────────────────────────────┐
│  CORE PLATFORM (compartidas, NO por tenant)                     │
│  - tenants                                                      │
│  - internal_users (Console)                                     │
│  - integration_templates (catálogo)                             │
│  - data_models (catálogo)                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PER-TENANT (todas con tenant_id + RLS)                          │
│                                                                  │
│  USERS & AUTH                                                    │
│   - users                                                        │
│   - roles                                                        │
│   - user_roles                                                   │
│                                                                  │
│  PEOPLE                                                          │
│   - people                                                       │
│   - people_history  (snapshots mensuales)                        │
│   - areas                                                        │
│   - positions                                                    │
│   - locations                                                    │
│   - org_structure  (jerarquía: parent/child áreas)               │
│                                                                  │
│  TIME & ATTENDANCE                                               │
│   - time_daily  (agregado diario)                                │
│   - absenteeism_events                                           │
│   - absenteeism_types                                            │
│                                                                  │
│  PAYROLL                                                         │
│   - payroll_periods                                              │
│   - payroll_entries                                              │
│   - payroll_concepts                                             │
│                                                                  │
│  CONFIG TENANT                                                   │
│   - tenant_integrations                                          │
│   - tenant_data_models  (qué modelos están activos)              │
│   - dashboard_configs                                            │
│                                                                  │
│  OBSERVABILITY                                                   │
│   - integration_runs                                             │
│   - audit_log                                                    │
│   - ai_usage                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Entidades core (detalle de esquema)

### 4.1 People (empleados)

```
people
├─ id (uuid pk)
├─ tenant_id (uuid, RLS)
├─ employee_code (varchar, unique por tenant)
├─ full_name, first_name, last_name (varchar)
├─ email, phone (varchar)
├─ birth_date (date)
├─ gender (enum: M/F/X/no-decl)
├─ nationality (varchar)
├─ document_type, document_number (varchar)
├─ hire_date (date)
├─ termination_date (date, nullable)
├─ termination_reason_id (fk, nullable)
├─ status (enum: active/inactive/on_leave)
├─ contract_type (enum: indefinido/plazo_fijo/contractor/temporal)
├─ area_id (fk areas)
├─ position_id (fk positions)
├─ manager_id (fk people, nullable)
├─ location_id (fk locations)
├─ salary_band (varchar o numeric, según cliente)
├─ created_at, updated_at (timestamptz)
├─ custom_fields (jsonb)  ← extensiones por cliente
```

### 4.2 Areas (estructura organizacional)

```
areas
├─ id (uuid pk)
├─ tenant_id
├─ code (varchar, unique por tenant)
├─ name (varchar)
├─ parent_area_id (fk areas, nullable)  ← jerarquía
├─ level (int, derivable de parent)
├─ status (active/inactive)
├─ custom_fields (jsonb)
```

### 4.3 Positions y Locations

```
positions
├─ id, tenant_id, code, name, level, family/grade, status, custom_fields

locations
├─ id, tenant_id, code, name, city, region, country, status, custom_fields
```

### 4.4 People history (snapshots mensuales)

```
people_history
├─ id (uuid pk)
├─ tenant_id
├─ snapshot_date (date, primer día del mes)  ← YYYY-MM-01
├─ person_id (fk people)
├─ employee_code
├─ status (al cierre del mes)
├─ area_id, position_id, manager_id, location_id (estado del mes)
├─ salary_band (al cierre del mes)
├─ tenure_months (calculado)
├─ created_at
├─ custom_fields_snapshot (jsonb)
```

**Generación:** job mensual programado (Trigger.dev / pg_cron) que corre el día 1 de cada mes y graba el estado actual de cada `people` activo + el último estado de los inactivos del mes anterior.

**Tamaño esperado:** ~N empleados × 12 meses × años de history. Para 500 empleados × 24 meses = 12k filas. Despreciable en Postgres.

### 4.5 Time & Attendance — agregado diario

```
time_daily
├─ id (uuid pk)
├─ tenant_id
├─ date (date)
├─ person_id (fk people)
├─ is_working_day (bool, según calendario laboral del tenant/persona)
├─ scheduled_hours (numeric)
├─ worked_hours (numeric)
├─ overtime_hours (numeric)
├─ absent_hours (numeric)
├─ has_absence (bool)
├─ source_integration_id (fk tenant_integrations)
├─ created_at, updated_at
├─ custom_fields (jsonb)

índice único (tenant_id, person_id, date)
```

### 4.6 Absenteeism — eventos

```
absenteeism_types
├─ id, tenant_id, code, name, category (medical/personal/justified/unjustified/other),
   counts_as_absence (bool), custom_fields

absenteeism_events
├─ id (uuid pk)
├─ tenant_id
├─ person_id (fk people)
├─ absenteeism_type_id (fk absenteeism_types)
├─ start_date, end_date (date)
├─ days_count, hours_count (numeric)
├─ justified (bool)
├─ cost_estimated (numeric, nullable)  ← si Payroll lo aporta
├─ status (enum: open/closed/cancelled)
├─ notes (text, opcional)
├─ source_integration_id
├─ created_at, updated_at
├─ custom_fields (jsonb)
```

### 4.7 Payroll (simplificado MVP)

```
payroll_periods
├─ id, tenant_id, period_code (e.g., '2026-01'), start_date, end_date, status

payroll_concepts  (catálogo de conceptos)
├─ id, tenant_id, code, name, category (basic_salary/bonus/overtime/absence_deduction/etc),
   sign (+/-), custom_fields

payroll_entries
├─ id, tenant_id, period_id, person_id, concept_id, amount, hours (nullable), custom_fields
   índice (tenant_id, period_id, person_id, concept_id)
```

**Nota:** payroll MVP captura solo lo necesario para calcular costos (ausentismo, HHEE). Detalle de liquidación queda fuera (no es nómina, es analytics).

### 4.8 Termination reasons (para Turnover)

```
termination_reasons
├─ id, tenant_id, code, name,
   category (voluntary/involuntary/end_of_contract/retirement/other),
   custom_fields
```

---

## 5. Customización por cliente

### 5.1 Patrón

- **Campos canónicos:** definidos en el schema, garantizan tipos y validación.
- **`custom_fields JSONB`:** cada tabla core lo tiene. El cliente declara su esquema custom en Console; los workflows de integración leen ese mapping y poblan custom_fields siguiendo el contrato del cliente.

### 5.2 Validación de custom_fields

Console permite definir un **JSON Schema** por tipo de campo custom (string, enum, number, date) por modelo. La integración valida contra ese schema antes de cargar.

### 5.3 Consulta desde dashboards

Postgres tiene operadores nativos para JSONB: `custom_fields->>'campo'`. Para campos muy consultados, se puede crear índice GIN o columna generada indexada.

---

## 6. Dashboards — métricas y dimensiones

### 6.1 Cubo / Headcount

**Propósito:** vista panorámica de la población activa con slice & dice.

**KPIs principales (cards):**
- Headcount total (activos al período seleccionado)
- Variación vs período anterior (Δ absoluto + %)
- Altas en el período
- Bajas en el período
- Headcount neto (activos al cierre)

**Visualizaciones:**
- Trend mensual de headcount (línea, últimos 12-24 meses).
- Distribución por área (barras horizontales).
- Distribución por nivel/posición (donut).
- Distribución por antigüedad (banda: <1y / 1-3y / 3-5y / 5-10y / 10y+).
- Distribución por género.
- Distribución por location.

**Drill-down (página de detalle):**
- Lista filtrable de empleados activos.
- Filtros: área, position, location, género, antigüedad, banda salarial.
- Insight IA: explicación de la composición + comparativo con período anterior.

**Dimensiones:** area, position, location, gender, tenure_band, salary_band, contract_type, manager.

**Fuente:** `people` + `people_history` (para selección temporal).

### 6.2 Ausentismos

**Propósito:** showcase para el cliente ancla. Visibilizar costos y patrones de ausentismo.

**KPIs principales:**
- **Tasa de ausentismo** = horas ausentes / horas laborables del período (%).
- **Costo de ausentismo** (suma de `cost_estimated` o derivado de Payroll).
- **# de eventos de ausentismo** en el período.
- **Duración promedio** de eventos (días).
- **Tasa por categoría** (médico / personal / injustificado).

**Visualizaciones:**
- Trend mensual de tasa de ausentismo (línea).
- Distribución por tipo de ausentismo (donut).
- Top 10 áreas con mayor tasa (barras).
- Top 10 personas con mayor # de eventos (barras).
- Heatmap día-de-semana × tipo (cuándo se concentra).

**Drill-down:**
- Lista de eventos con filtros (persona, tipo, área, fechas).
- Insight IA: anomalías (áreas con tasa fuera del rango histórico), recomendaciones (políticas, atención específica).

**Dimensiones:** absenteeism_type, area, position, location, gender, mes, antigüedad.

**Fuente:** `absenteeism_events` + join con `people` + `people_history` para dimensión histórica + opcional `payroll_entries` para costo real.

### 6.3 Horas extras

**Propósito:** complemento de ausentismos. Visibilizar volumen y costo de HHEE.

**KPIs principales:**
- **Total HHEE** en el período (horas).
- **Costo HHEE** (de Payroll).
- **% personas con HHEE** (de los activos).
- **HHEE promedio por persona** (sobre activos).
- **HHEE máximo individual** (alerta de sobre-exposición).

**Visualizaciones:**
- Trend mensual de HHEE (línea, horas y costo).
- Top 10 áreas con más HHEE (barras).
- Distribución de HHEE por persona (histograma para ver concentración).
- HHEE por jefatura (manager) — barras.

**Drill-down:**
- Lista de personas con HHEE en el período + horas + costo.
- Filtros: área, manager, rango HHEE, position.
- Insight IA: detectar concentración riesgosa (1 persona con HHEE excesivas), patrones por área.

**Dimensiones:** area, position, manager, location, mes.

**Fuente:** `time_daily.overtime_hours` agregado + `payroll_entries` (concepto HHEE) para costo.

### 6.4 Turnover / Rotación

**Propósito:** métrica estándar de people analytics. Salud organizacional.

**KPIs principales:**
- **Tasa de rotación anualizada** = bajas en el período / headcount promedio × (12 / meses_periodo).
- **Bajas** en el período.
- **Altas** en el período.
- **Antigüedad promedio al egreso** (meses).
- **% rotación voluntaria** vs involuntaria.

**Visualizaciones:**
- Trend mensual de tasa de rotación (línea).
- Distribución de bajas por motivo (donut).
- Bajas por área (barras).
- Distribución de antigüedad al egreso (histograma).
- Comparativo voluntaria vs involuntaria por mes.

**Drill-down:**
- Lista de bajas: persona, fecha baja, motivo, antigüedad al egreso, área, position.
- Filtros: motivo, área, position, mes, tipo (voluntaria/involuntaria).
- Insight IA: detectar áreas con rotación atípica, correlaciones (alta rotación + ausentismo alto en misma área).

**Dimensiones:** termination_reason, area, position, location, mes, antigüedad_band, contract_type.

**Fuente:** `people` (con `termination_date` y `termination_reason_id`) + `people_history` para denominador (headcount promedio).

---

## 7. Período de datos

**Decisión propuesta para cerrar en Fase 4:**

- **Histórico inicial:** **24 meses hacia atrás** desde la activación del tenant. Suficiente para análisis YoY y patrones estacionales.
- **Retención forward:** indefinida (lo que entre se queda).
- **Snapshots:** mensual desde la activación.
- **Plan Enterprise (v2.x):** opción de cargar history más largo (5-10 años) como add-on.

> Definir con el cliente ancla si su retención puede ser menor (ej. 12 meses) para acelerar la carga inicial.

---

## 8. Volúmenes esperados (orden de magnitud)

Cliente ancla (500 empleados):

| Tabla | Filas esperadas (24m de history) |
|---|---|
| `people` | ~500–600 (incluye bajas históricas) |
| `people_history` | 500 × 24 = 12k |
| `time_daily` | 500 × 24 × ~22 días/mes = ~260k |
| `absenteeism_events` | ~5k (alta variabilidad) |
| `payroll_entries` | 500 × 24 × ~10 conceptos = ~120k |

Total inicial ancla: < 1M filas. Postgres trivial. Suficiente con tier Pro de Supabase.

PyME promedio (50 empleados, 12m history): orden de ~50k filas. Sin presión.

---

## 9. Triggers de integración (resumen)

> Detalle en `06-integraciones.md`.

| Trigger | Caso de uso | MVP |
|---|---|---|
| Cron schedule | API Manú, API Geovictoria, file-based si hay watched folder | ✅ |
| Upload manual desde UI Cliente | XLS/CSV/JSON ad-hoc | ✅ |
| Trigger manual ("Run now") | Forzar refresh de cualquier integración | ✅ |
| Watched folder / SFTP / Email | Recepción pasiva de archivos | 🔜 v1.x (modelo preparado, implementación diferida) |

---

## 10. Decisiones tomadas en esta fase

| # | Decisión | Estado |
|---|---|---|
| D-039 | Granularidad T&A: daily aggregate + eventos de ausentismo | ✅ Cerrada |
| D-040 | History: snapshot mensual de `people` (SCD2 diferido a v1.x si hace falta) | ✅ Cerrada |
| D-041 | Schema rígido + `custom_fields JSONB` en cada tabla core | ✅ Cerrada |
| D-042 | Modelos MVP: People, Time & Attendance, Payroll (simplificado), Reference tables | ✅ Cerrada |
| D-043 | Triggers integración MVP: Cron + Upload manual + Trigger manual | ✅ Cerrada |
| D-044 | SFTP / Email watched folder: modelado pero no implementado en MVP (v1.x) | ✅ Cerrada |
| D-045 | 4 dashboards con métricas y dimensiones definidas (§6) | ✅ Cerrada |
| D-046 | Período histórico inicial: 24 meses | 🟡 Propuesta — confirmar con cliente ancla |

---

## 11. Decisiones abiertas

- **Confirmar período histórico** con el cliente ancla (24 meses propuesto).
- **Calendario laboral por persona o por tenant**: ¿se modela calendario laboral configurable (turnos rotativos, etc.) o se asume calendario único por tenant? Importante para `is_working_day` y horas laborables.
- **Costos de ausentismo y HHEE**: ¿se calculan derivados de Payroll o se reciben pre-calculados de las integraciones? Impacta complejidad del modelo.
- **Multi-currency**: el cliente ancla es local (1 moneda). Si v1.x suma clientes multi-país, hay que soportar conversión.
- **Mejora a SCD2** para campos críticos: a evaluar en v1.x si snapshot mensual se queda corto.

---

## 12. Próximos pasos

→ Pasa a `06-integraciones.md`: workflows concretos de cada integración (file-based + Manú + Geovictoria), con extract/transform/load, mapeo a las tablas de este documento, reglas configurables por cliente, manejo de errores.
