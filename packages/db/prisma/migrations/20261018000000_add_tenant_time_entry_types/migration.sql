-- =============================================================================
-- Tipos de hora por tenant (dashboard de Horas extras).
-- Catálogo global cfg_time_entry_types: categorías nuevas (regular, overtime, training, holiday,
-- absence, other), marca is_authorized y tipos de horas extra estándar (50%, 100%, otra categoría,
-- no autorizadas y extra nocturna). Cada tenant recibe una copia en cfg_tenant_time_entry_types y
-- las entradas diarias pasan a apuntar a ese tipo (el portal define la categoría; el archivo no la pisa).
-- =============================================================================

-- ── Catálogo global ──────────────────────────────────────────────────────────
ALTER TABLE "cfg_time_entry_types" ADD COLUMN "is_authorized" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cfg_time_entry_types" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Vocabulario nuevo de categorías ('special' se reparte según el tipo)
UPDATE "cfg_time_entry_types" SET "category" = 'regular'  WHERE "code" IN ('REGULAR', 'NIGHT');
UPDATE "cfg_time_entry_types" SET "category" = 'training' WHERE "code" = 'TRAINING';
UPDATE "cfg_time_entry_types" SET "category" = 'holiday'  WHERE "code" = 'HOLIDAY';
UPDATE "cfg_time_entry_types" SET "category" = 'other'    WHERE "category" NOT IN ('regular', 'overtime', 'training', 'holiday', 'absence', 'other');

INSERT INTO "cfg_time_entry_types" ("code", "name", "category", "sign", "is_authorized", "sort_order") VALUES
  ('REGULAR',    'Horas regulares',                  'regular',  1, true,  1),
  ('NIGHT',      'Horas nocturnas',                  'regular',  1, true,  2),
  ('TRAINING',   'Capacitación',                     'training', 1, true,  3),
  ('HOLIDAY',    'Día feriado',                      'holiday',  1, true,  4),
  ('ABSENT',     'Ausencia',                         'absence', -1, true,  5),
  ('SICK_LEAVE', 'Licencia por enfermedad',          'absence', -1, true,  6),
  ('OVERTIME',   'Horas extra',                      'overtime', 1, true,  7),
  ('OT50',       'Hora extra 50%',                   'overtime', 1, true,  8),
  ('OT50OC',     'Hora extra 50% otra categoría',    'overtime', 1, true,  9),
  ('OT100',      'Hora extra 100%',                  'overtime', 1, true, 10),
  ('OT100OC',    'Hora extra 100% otra categoría',   'overtime', 1, true, 11),
  ('OTNIGHT',    'Hora extra nocturna',              'overtime', 1, true, 12),
  ('OT50NA',     'Hora extra 50% no autorizada',     'overtime', 1, false, 13),
  ('OT100NA',    'Hora extra 100% no autorizada',    'overtime', 1, false, 14)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "sign" = EXCLUDED."sign",
  "is_authorized" = EXCLUDED."is_authorized",
  "sort_order" = EXCLUDED."sort_order";

ALTER TABLE "cfg_time_entry_types" ADD CONSTRAINT "cfg_time_entry_types_category_check"
  CHECK ("category" IN ('regular', 'overtime', 'training', 'holiday', 'absence', 'other'));

-- ── Tipos por tenant ─────────────────────────────────────────────────────────
CREATE TABLE "cfg_tenant_time_entry_types" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "sign" SMALLINT NOT NULL DEFAULT 1,
    "is_authorized" BOOLEAN NOT NULL DEFAULT true,
    "is_classified" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cfg_tenant_time_entry_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cfg_tenant_time_entry_types_category_check"
      CHECK ("category" IN ('regular', 'overtime', 'training', 'holiday', 'absence', 'other')),
    CONSTRAINT "cfg_tenant_time_entry_types_sign_check" CHECK ("sign" IN (-1, 1))
);

CREATE UNIQUE INDEX "uq_cfg_tenant_time_entry_types_tenant_code" ON "cfg_tenant_time_entry_types"("tenant_id", "code");

ALTER TABLE "cfg_tenant_time_entry_types"
  ADD CONSTRAINT "cfg_tenant_time_entry_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: todos los tenants reciben el catálogo completo (antes de activar RLS)
INSERT INTO "cfg_tenant_time_entry_types" ("tenant_id", "code", "name", "category", "sign", "is_authorized", "is_classified", "sort_order", "updated_at")
SELECT te."id", c."code", c."name", c."category", c."sign", c."is_authorized", true, c."sort_order", now()
FROM "tenants" te
CROSS JOIN "cfg_time_entry_types" c
WHERE c."is_active" = true
ON CONFLICT ("tenant_id", "code") DO NOTHING;

ALTER TABLE "cfg_tenant_time_entry_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cfg_tenant_time_entry_types" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "cfg_tenant_time_entry_types"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ── Entradas diarias: apuntan al tipo del tenant ─────────────────────────────
ALTER TABLE "att_time_daily_entries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "att_time_daily_entries" ADD COLUMN "time_entry_type_id" INTEGER;

UPDATE "att_time_daily_entries" e
SET "time_entry_type_id" = t."id"
FROM "cfg_tenant_time_entry_types" t
WHERE t."tenant_id" = e."tenant_id" AND t."code" = e."time_entry_type_code";

ALTER TABLE "att_time_daily_entries" ALTER COLUMN "time_entry_type_id" SET NOT NULL;

DROP INDEX "att_time_daily_entries_tenant_id_time_daily_id_time_entry_t_key";
DROP INDEX "att_time_daily_entries_tenant_id_time_entry_type_code_idx";
ALTER TABLE "att_time_daily_entries" DROP CONSTRAINT "att_time_daily_entries_time_entry_type_code_fkey";
ALTER TABLE "att_time_daily_entries" DROP COLUMN "time_entry_type_code";

ALTER TABLE "att_time_daily_entries"
  ADD CONSTRAINT "att_time_daily_entries_time_entry_type_id_fkey" FOREIGN KEY ("time_entry_type_id") REFERENCES "cfg_tenant_time_entry_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "uq_att_time_daily_entries" ON "att_time_daily_entries"("tenant_id", "time_daily_id", "time_entry_type_id");
CREATE INDEX "att_time_daily_entries_tenant_id_time_entry_type_id_idx" ON "att_time_daily_entries"("tenant_id", "time_entry_type_id");

ALTER TABLE "att_time_daily_entries" ADD CONSTRAINT "att_time_daily_entries_hours_check" CHECK ("hours" >= 0);

ALTER TABLE "att_time_daily_entries" FORCE ROW LEVEL SECURITY;
