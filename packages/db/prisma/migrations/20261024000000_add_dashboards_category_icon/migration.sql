-- =============================================================================
-- Catálogo de dashboards: categoría (para agrupar el hub de dashboards: hr, finance, other) e ícono (nombre del
-- ícono que muestra la tarjeta del hub).
-- =============================================================================

ALTER TABLE "cfg_dashboards" ADD COLUMN "category" VARCHAR(30) NOT NULL DEFAULT 'other';
ALTER TABLE "cfg_dashboards" ADD COLUMN "icon" VARCHAR(40);
ALTER TABLE "cfg_dashboards" ADD CONSTRAINT "cfg_dashboards_category_check" CHECK ("category" IN ('hr', 'finance', 'other'));

UPDATE "cfg_dashboards" SET "category" = 'hr', "icon" = 'users-round'    WHERE "code" = 'headcount';
UPDATE "cfg_dashboards" SET "category" = 'hr', "icon" = 'calendar-off'   WHERE "code" = 'absenteeism';
UPDATE "cfg_dashboards" SET "category" = 'hr', "icon" = 'timer'          WHERE "code" = 'overtime';
UPDATE "cfg_dashboards" SET "category" = 'hr', "icon" = 'user-minus'     WHERE "code" = 'turnover';
UPDATE "cfg_dashboards" SET "category" = 'hr', "icon" = 'wallet'         WHERE "code" = 'payroll';
