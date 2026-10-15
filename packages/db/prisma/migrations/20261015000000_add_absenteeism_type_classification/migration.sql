-- =============================================================================
-- Clasificación de tipos de ausencia: category -> class (10 clases) + is_classified.
-- Clases de ausentismo: medical, accident, unpaid, unjustified, suspension, personal, other.
-- Clases que no cuentan como ausentismo por defecto: vacation, legal_leave, day_off.
-- is_classified = false: el tipo llegó de un archivo y nadie lo clasificó todavía.
-- =============================================================================

ALTER TABLE "cfg_absenteeism_types" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "cfg_absenteeism_types" RENAME COLUMN "category" TO "class";

-- Backfill: valores viejos -> clases nuevas
UPDATE "cfg_absenteeism_types" SET "class" = 'legal_leave', "counts_as_absence" = false WHERE "class" = 'justified';
UPDATE "cfg_absenteeism_types" SET "class" = 'vacation',    "counts_as_absence" = false WHERE upper("code") IN ('VACACIONES', 'VACATION', 'VAC');

ALTER TABLE "cfg_absenteeism_types" ADD COLUMN "is_classified" BOOLEAN NOT NULL DEFAULT true;

-- Los tipos creados automáticamente por el worker (nombre = código, clase 'other') quedan sin clasificar
UPDATE "cfg_absenteeism_types" SET "is_classified" = false WHERE "class" = 'other' AND "name" = "code";

ALTER TABLE "cfg_absenteeism_types" ADD CONSTRAINT "cfg_absenteeism_types_class_check"
  CHECK ("class" IN ('medical','accident','unpaid','unjustified','suspension','personal','other','vacation','legal_leave','day_off'));

ALTER TABLE "cfg_absenteeism_types" FORCE ROW LEVEL SECURITY;
