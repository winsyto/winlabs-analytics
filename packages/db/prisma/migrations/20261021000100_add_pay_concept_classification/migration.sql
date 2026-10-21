-- =============================================================================
-- Clasificación de conceptos de liquidación.
--  concept_type:    tipo estándar (13 tipos: sueldo remunerativo, aportes del empleado, acumuladores...).
--  reference_total: 'gross' o 'net' marca el acumulador que es el sueldo bruto o el neto (uno de cada uno por tenant).
--  is_classified:   false = llegó de un archivo y todavía no fue clasificado por un admin.
-- Las columnas category y sign se eliminan en una migración posterior (primero se usan para migrar los datos).
-- =============================================================================

ALTER TABLE "pay_concepts" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "pay_concepts" ADD COLUMN "concept_type" VARCHAR(40);
ALTER TABLE "pay_concepts" ADD COLUMN "reference_total" VARCHAR(10);
ALTER TABLE "pay_concepts" ADD COLUMN "is_classified" BOOLEAN NOT NULL DEFAULT true;

-- Categorías anteriores -> tipo de concepto
UPDATE "pay_concepts" SET "concept_type" = 'salary'     WHERE "category" IN ('basic_salary', 'overtime', 'bonus');
UPDATE "pay_concepts" SET "concept_type" = 'deductions' WHERE "category" = 'absence_deduction';
UPDATE "pay_concepts" SET "is_classified" = false       WHERE "concept_type" IS NULL;

ALTER TABLE "pay_concepts" ADD CONSTRAINT "pay_concepts_type_check"
  CHECK ("concept_type" IS NULL OR "concept_type" IN (
    'employee_contribution', 'additional', 'family_allowance', 'employer_contribution', 'deductions', 'garnishments',
    'loans', 'income_tax', 'non_remunerative', 'provisions', 'sac', 'salary', 'accumulators'));
ALTER TABLE "pay_concepts" ADD CONSTRAINT "pay_concepts_reference_total_check"
  CHECK ("reference_total" IS NULL OR "reference_total" IN ('gross', 'net'));

CREATE UNIQUE INDEX "uq_pay_concepts_reference_total" ON "pay_concepts"("tenant_id", "reference_total") WHERE "reference_total" IS NOT NULL;

ALTER TABLE "pay_concepts" FORCE ROW LEVEL SECURITY;
