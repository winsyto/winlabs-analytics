-- =============================================================================
-- Motor de ausentismo (Dashboard 2):
--  * wla_workdays(desde, hasta, semana): cantidad de días laborables entre dos fechas (ambas incluidas).
--    "semana" son 7 caracteres 0/1, lunes a domingo ("1111100" = lunes a viernes).
--    Cálculo aritmético en tiempo constante (no recorre los días): días laborables hasta `hasta`
--    menos los días laborables hasta el día anterior a `desde`.
--  * Índice para cruzar eventos de ausencia con un período.
-- =============================================================================

-- Días laborables desde el lunes 1900-01-01 (incluido) hasta `d` (incluido)
CREATE OR REPLACE FUNCTION wla_workdays_until(d date, week text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT ((d - date '1900-01-01' + 1) / 7) * (length(week) - length(replace(week, '1', '')))
       + (length(substr(week, 1, (d - date '1900-01-01' + 1) % 7))
          - length(replace(substr(week, 1, (d - date '1900-01-01' + 1) % 7), '1', '')))
$$;

CREATE OR REPLACE FUNCTION wla_workdays(a date, b date, week text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL OR b < a THEN 0
    ELSE wla_workdays_until(b, week) - wla_workdays_until(a - 1, week)
  END
$$;

CREATE INDEX "att_absenteeism_events_tenant_dates_idx"
  ON "att_absenteeism_events"("tenant_id", "start_date", "end_date");
