-- =============================================================================
-- Eventos de ausencia: días y horas pasan a ser opcionales.
--   days_count  = cantidad de días del evento (NULL = no vino en el archivo; lo calcula el dashboard
--                 con el turno de la persona).
--   hours_count = horas de ausencia POR DÍA en una ausencia parcial (NULL = día completo).
-- Hasta ahora un 0 significaba "no vino": esos valores pasan a NULL.
-- Además, el fin del evento no puede ser anterior al inicio (NOT VALID: solo controla filas nuevas).
-- =============================================================================

ALTER TABLE "att_absenteeism_events" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "att_absenteeism_events"
  ALTER COLUMN "days_count" DROP NOT NULL,
  ALTER COLUMN "days_count" DROP DEFAULT,
  ALTER COLUMN "hours_count" DROP NOT NULL,
  ALTER COLUMN "hours_count" DROP DEFAULT;

UPDATE "att_absenteeism_events" SET "days_count" = NULL WHERE "days_count" = 0;
UPDATE "att_absenteeism_events" SET "hours_count" = NULL WHERE "hours_count" = 0;

ALTER TABLE "att_absenteeism_events"
  ADD CONSTRAINT "att_absenteeism_events_dates_check" CHECK ("end_date" >= "start_date") NOT VALID;

ALTER TABLE "att_absenteeism_events" FORCE ROW LEVEL SECURITY;
