-- =============================================================================
-- Procesos de liquidación: período -> proceso -> persona -> concepto.
-- Un período (el mes de liquidación) tiene 0, 1 o varios procesos de cada tipo (mensual, quincenal, SAC...).
-- pay_entries pasa a colgar del proceso (se elimina period_id) y hours pasa a quantity (cantidad opcional).
-- =============================================================================

CREATE TABLE "pay_processes" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "process_type" VARCHAR(30) NOT NULL DEFAULT 'monthly',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_processes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pay_processes_type_check"
      CHECK ("process_type" IN ('monthly', 'biweekly', 'weekly', 'sac', 'adjustments', 'provisions', 'final_settlement', 'vacation')),
    CONSTRAINT "pay_processes_dates_check" CHECK ("end_date" >= "start_date")
);

CREATE UNIQUE INDEX "uq_pay_processes_period_code" ON "pay_processes"("tenant_id", "period_id", "code");
CREATE INDEX "pay_processes_period_id_idx" ON "pay_processes"("period_id");

ALTER TABLE "pay_processes"
  ADD CONSTRAINT "pay_processes_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pay_processes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_processes" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pay_processes"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Backfill: cada período con entradas recibe un proceso mensual con sus mismas fechas
ALTER TABLE "pay_periods" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_entries" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_processes" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "pay_processes" ("tenant_id", "period_id", "code", "description", "process_type", "start_date", "end_date", "updated_at")
SELECT p."tenant_id", p."id", 'MENSUAL', 'Liquidación mensual', 'monthly', p."start_date", p."end_date", now()
FROM "pay_periods" p
WHERE EXISTS (SELECT 1 FROM "pay_entries" e WHERE e."period_id" = p."id");

ALTER TABLE "pay_entries" ADD COLUMN "process_id" INTEGER;

UPDATE "pay_entries" e
SET "process_id" = pr."id"
FROM "pay_processes" pr
WHERE pr."period_id" = e."period_id" AND pr."tenant_id" = e."tenant_id";

ALTER TABLE "pay_entries" ALTER COLUMN "process_id" SET NOT NULL;

DROP INDEX "pay_entries_tenant_id_period_id_person_id_concept_id_key";
DROP INDEX "pay_entries_tenant_id_period_id_person_id_idx";
ALTER TABLE "pay_entries" DROP CONSTRAINT "pay_entries_period_id_fkey";
ALTER TABLE "pay_entries" DROP COLUMN "period_id";
ALTER TABLE "pay_entries" RENAME COLUMN "hours" TO "quantity";

ALTER TABLE "pay_entries"
  ADD CONSTRAINT "pay_entries_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "pay_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "uq_pay_entries_process_person_concept" ON "pay_entries"("tenant_id", "process_id", "person_id", "concept_id");
-- Las claves foráneas necesitan un índice que empiece por su columna (borrar o actualizar el lado padre recorre la tabla si no)
CREATE INDEX "pay_entries_process_id_idx" ON "pay_entries"("process_id");
CREATE INDEX "pay_entries_person_id_idx" ON "pay_entries"("person_id");
CREATE INDEX "pay_entries_concept_id_idx" ON "pay_entries"("concept_id");

ALTER TABLE "pay_periods" FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_processes" FORCE ROW LEVEL SECURITY;
