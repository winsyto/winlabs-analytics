-- =============================================================================
-- Clases de concepto: la agrupación que muestra el dashboard de Payroll.
--  pay_concept_classes: clases del tenant (seed base de 6, editable). side = earning (suma a la masa bruta) o
--                       deduction (retención, se muestra aparte).
--  pay_class_rules:     qué entra en cada clase, por tipo de concepto (todos los conceptos del tipo) o por concepto
--                       puntual. El concepto gana sobre el tipo.
-- =============================================================================

CREATE TABLE "pay_concept_classes" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "side" VARCHAR(10) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_concept_classes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pay_concept_classes_side_check" CHECK ("side" IN ('earning', 'deduction'))
);

CREATE UNIQUE INDEX "uq_pay_concept_classes_tenant_code" ON "pay_concept_classes"("tenant_id", "code");

CREATE TABLE "pay_class_rules" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "class_id" INTEGER NOT NULL,
    "concept_type" VARCHAR(40),
    "concept_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_class_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pay_class_rules_one_target_check" CHECK (num_nonnulls("concept_type", "concept_id") = 1),
    CONSTRAINT "pay_class_rules_type_check"
      CHECK ("concept_type" IS NULL OR "concept_type" IN (
        'employee_contribution', 'additional', 'family_allowance', 'employer_contribution', 'deductions', 'garnishments',
        'loans', 'income_tax', 'non_remunerative', 'provisions', 'sac', 'salary', 'accumulators'))
);

-- Un tipo y un concepto pertenecen a una sola clase por tenant
CREATE UNIQUE INDEX "uq_pay_class_rules_type" ON "pay_class_rules"("tenant_id", "concept_type") WHERE "concept_type" IS NOT NULL;
CREATE UNIQUE INDEX "uq_pay_class_rules_concept" ON "pay_class_rules"("tenant_id", "concept_id") WHERE "concept_id" IS NOT NULL;
CREATE INDEX "pay_class_rules_class_id_idx" ON "pay_class_rules"("class_id");
CREATE INDEX "pay_class_rules_concept_id_idx" ON "pay_class_rules"("concept_id");

ALTER TABLE "pay_class_rules"
  ADD CONSTRAINT "pay_class_rules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "pay_concept_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_class_rules"
  ADD CONSTRAINT "pay_class_rules_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "pay_concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pay_concept_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_concept_classes" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "pay_class_rules"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_class_rules"     FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pay_concept_classes"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "pay_class_rules"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Seed base para todos los tenants existentes (los nuevos lo reciben con applyDefaultPayrollClasses)
ALTER TABLE "pay_concept_classes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_class_rules"     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_concepts"        NO FORCE ROW LEVEL SECURITY;

INSERT INTO "pay_concept_classes" ("tenant_id", "code", "name", "side", "sort_order", "updated_at")
SELECT te."id", c."code", c."name", c."side", c."sort_order", now()
FROM "tenants" te
CROSS JOIN (VALUES
  ('sueldo',             'Sueldo',              'earning',   1),
  ('horas_extra',        'Horas extra',         'earning',   2),
  ('bonos',              'Bonos',               'earning',   3),
  ('otros_haberes',      'Otros haberes',       'earning',   4),
  ('impuestos',          'Impuestos y aportes', 'deduction', 5),
  ('otras_retenciones',  'Otras retenciones',   'deduction', 6)
) AS c("code", "name", "side", "sort_order");

INSERT INTO "pay_class_rules" ("tenant_id", "class_id", "concept_type")
SELECT cl."tenant_id", cl."id", r."concept_type"
FROM "pay_concept_classes" cl
JOIN (VALUES
  ('sueldo', 'salary'), ('sueldo', 'sac'),
  ('otros_haberes', 'additional'), ('otros_haberes', 'family_allowance'), ('otros_haberes', 'non_remunerative'),
  ('impuestos', 'employee_contribution'), ('impuestos', 'income_tax'),
  ('otras_retenciones', 'deductions'), ('otras_retenciones', 'garnishments'), ('otras_retenciones', 'loans')
) AS r("class_code", "concept_type") ON r."class_code" = cl."code";

-- Conceptos que ya existían con categoría de horas extra o de bono: regla por concepto (gana sobre el tipo)
INSERT INTO "pay_class_rules" ("tenant_id", "class_id", "concept_id")
SELECT pc."tenant_id", cl."id", pc."id"
FROM "pay_concepts" pc
JOIN "pay_concept_classes" cl
  ON cl."tenant_id" = pc."tenant_id"
 AND cl."code" = CASE pc."category" WHEN 'overtime' THEN 'horas_extra' WHEN 'bonus' THEN 'bonos' END
WHERE pc."category" IN ('overtime', 'bonus');

ALTER TABLE "pay_concept_classes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_class_rules"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_concepts"        FORCE ROW LEVEL SECURITY;
