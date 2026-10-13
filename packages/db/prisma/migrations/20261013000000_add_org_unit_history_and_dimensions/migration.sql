-- =============================================================================
-- Unidades organizativas con vigencia + configuración de dimensiones por tenant
--  1. Catálogo global ampliado (15 tipos) con sort_order
--  2. hr_people_org_assignments con valid_from / valid_to (fuente de verdad de la historia)
--  3. Contrato como tipo de unidad organizativa (CONTRACT)
--  4. cfg_tenant_org_unit_types y dsh_dimensions (configuración por tenant)
-- Las tablas con RLS FORCE se deshabilitan temporalmente (NO FORCE) para backfillear
-- datos de todos los tenants desde el owner de la tabla.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Catálogo global --------------------------------------------------------
ALTER TABLE "cfg_org_unit_types" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

INSERT INTO "cfg_org_unit_types" ("code", "name", "description", "is_active", "sort_order") VALUES
  ('COMPANY',       'Empresa',              'Empresa / razón social dentro del grupo del cliente', true, 1),
  ('LOCATION',      'Sucursal',             'Lugar de trabajo / sede', true, 2),
  ('AREA',          'Área',                 'Área / sector', true, 3),
  ('POSITION',      'Puesto',               'Cargo / puesto', true, 4),
  ('CONTRACT',      'Contrato',             'Tipo de contrato (tiempo determinado, indeterminado, pasante, etc.)', true, 5),
  ('DEPARTMENT',    'Departamento',         'Subdivisión de un área', true, 6),
  ('COST_CENTER',   'Centro de costos',     'Unidad de imputación contable', true, 7),
  ('MANAGEMENT',    'Gerencia',             'Gerencia', true, 8),
  ('CATEGORY',      'Categoría',            'Categoría laboral', true, 9),
  ('SHIFT',         'Turno',                'Agrupación para tiempos y asistencia', true, 10),
  ('UNION',         'Sindicato',            'Sindicato', true, 11),
  ('AGREEMENT',     'Convenio',             'Convenio colectivo', true, 12),
  ('PAY_FREQUENCY', 'Forma de liquidación', 'Mensual, quincenal, semanal, etc.', true, 13),
  ('AGENCY',        'Agencia',              'Agencia (personal contratado por tercero)', true, 14),
  ('ART',           'ART',                  'Aseguradora de Riesgos del Trabajo', true, 15)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "sort_order" = EXCLUDED."sort_order";

-- 2. Asignaciones con vigencia ---------------------------------------------
ALTER TABLE "hr_org_units"              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people"                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people_org_assignments" NO FORCE ROW LEVEL SECURITY;

-- Unicidad (id, tipo) para la FK compuesta que garantiza coherencia tipo/unidad
CREATE UNIQUE INDEX "uq_hr_org_units_id_type" ON "hr_org_units"("id", "org_unit_type_code");

ALTER TABLE "hr_people_org_assignments"
  ADD COLUMN "org_unit_type_code" TEXT,
  ADD COLUMN "valid_from" DATE,
  ADD COLUMN "valid_to" DATE;

-- Si una persona tiene más de una asignación del mismo tipo (solo posible por cargas
-- anteriores sin vigencias), se conserva la más reciente.
DELETE FROM "hr_people_org_assignments" a
USING "hr_org_units" ou, "hr_org_units" ou2, "hr_people_org_assignments" b
WHERE ou.id = a.org_unit_id
  AND ou2.id = b.org_unit_id
  AND a.person_id = b.person_id
  AND ou.org_unit_type_code = ou2.org_unit_type_code
  AND a.id < b.id;

UPDATE "hr_people_org_assignments" a
SET "org_unit_type_code" = ou."org_unit_type_code",
    "valid_from" = COALESCE(p."hire_date", a."created_at"::date),
    "valid_to"   = CASE
                     WHEN p."termination_date" IS NULL THEN NULL
                     ELSE GREATEST(p."termination_date", COALESCE(p."hire_date", a."created_at"::date))
                   END
FROM "hr_org_units" ou, "hr_people" p
WHERE ou.id = a.org_unit_id AND p.id = a.person_id;

ALTER TABLE "hr_people_org_assignments"
  ALTER COLUMN "org_unit_type_code" SET NOT NULL,
  ALTER COLUMN "valid_from" SET NOT NULL;

DROP INDEX "hr_people_org_assignments_tenant_id_person_id_org_unit_id_key";
ALTER TABLE "hr_people_org_assignments" DROP COLUMN "is_primary";
ALTER TABLE "hr_people_org_assignments" DROP CONSTRAINT "hr_people_org_assignments_org_unit_id_fkey";

CREATE UNIQUE INDEX "uq_hr_people_org_assignments"
  ON "hr_people_org_assignments"("tenant_id", "person_id", "org_unit_id", "valid_from");
CREATE INDEX "hr_people_org_assignments_tenant_id_org_unit_type_code_valid_from_valid_to_idx"
  ON "hr_people_org_assignments"("tenant_id", "org_unit_type_code", "valid_from", "valid_to");

ALTER TABLE "hr_people_org_assignments"
  ADD CONSTRAINT "hr_people_org_assignments_org_unit_fkey"
    FOREIGN KEY ("org_unit_id", "org_unit_type_code")
    REFERENCES "hr_org_units"("id", "org_unit_type_code") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hr_people_org_assignments_org_unit_type_code_fkey"
    FOREIGN KEY ("org_unit_type_code")
    REFERENCES "cfg_org_unit_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "chk_hr_people_org_assignments_dates"
    CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from"),
  ADD CONSTRAINT "excl_hr_people_org_assignments_no_overlap"
    EXCLUDE USING gist (
      "person_id" WITH =,
      "org_unit_type_code" WITH =,
      daterange("valid_from", "valid_to", '[]') WITH &&
    );

-- 3. Contrato como unidad organizativa -------------------------------------
INSERT INTO "hr_org_units" ("tenant_id", "org_unit_type_code", "code", "name", "level", "is_active", "updated_at")
SELECT DISTINCT p."tenant_id", 'CONTRACT', p."contract_type",
  CASE p."contract_type"
    WHEN 'indefinido' THEN 'Indefinido'
    WHEN 'plazo_fijo' THEN 'Plazo fijo'
    WHEN 'temporal'   THEN 'Temporal'
    WHEN 'contractor' THEN 'Contratista'
    ELSE initcap(replace(p."contract_type", '_', ' '))
  END,
  0, true, now()
FROM "hr_people" p
WHERE p."contract_type" IS NOT NULL AND p."deleted_at" IS NULL
ON CONFLICT ("tenant_id", "org_unit_type_code", "code") DO NOTHING;

INSERT INTO "hr_people_org_assignments"
  ("tenant_id", "person_id", "org_unit_id", "org_unit_type_code", "valid_from", "valid_to")
SELECT p."tenant_id", p."id", ou."id", 'CONTRACT', p."hire_date",
  CASE WHEN p."termination_date" IS NULL THEN NULL ELSE GREATEST(p."termination_date", p."hire_date") END
FROM "hr_people" p
JOIN "hr_org_units" ou
  ON ou."tenant_id" = p."tenant_id" AND ou."org_unit_type_code" = 'CONTRACT' AND ou."code" = p."contract_type"
WHERE p."contract_type" IS NOT NULL AND p."deleted_at" IS NULL
ON CONFLICT DO NOTHING;

-- 4. Configuración por tenant ----------------------------------------------
CREATE TABLE "cfg_tenant_org_unit_types" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "org_unit_type_code" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cfg_tenant_org_unit_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dsh_dimensions" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dashboard_code" VARCHAR(50) NOT NULL,
    "org_unit_type_code" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dsh_dimensions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_cfg_tenant_org_unit_types" ON "cfg_tenant_org_unit_types"("tenant_id", "org_unit_type_code");
CREATE UNIQUE INDEX "uq_dsh_dimensions" ON "dsh_dimensions"("tenant_id", "dashboard_code", "org_unit_type_code");

ALTER TABLE "cfg_tenant_org_unit_types"
  ADD CONSTRAINT "cfg_tenant_org_unit_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "cfg_tenant_org_unit_types_org_unit_type_code_fkey" FOREIGN KEY ("org_unit_type_code") REFERENCES "cfg_org_unit_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dsh_dimensions"
  ADD CONSTRAINT "dsh_dimensions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "dsh_dimensions_org_unit_type_code_fkey" FOREIGN KEY ("org_unit_type_code") REFERENCES "cfg_org_unit_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: tipos habilitados = 5 por defecto + los que el tenant ya usa
INSERT INTO "cfg_tenant_org_unit_types" ("tenant_id", "org_unit_type_code", "is_enabled", "sort_order", "updated_at")
SELECT t."id", ty."code",
  (ty."code" IN ('COMPANY', 'LOCATION', 'AREA', 'POSITION', 'CONTRACT')
   OR EXISTS (SELECT 1 FROM "hr_org_units" o WHERE o."tenant_id" = t."id" AND o."org_unit_type_code" = ty."code")),
  ty."sort_order", now()
FROM "tenants" t CROSS JOIN "cfg_org_unit_types" ty;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT t."id", 'headcount', ty."code", ty."sort_order"
FROM "tenants" t JOIN "cfg_org_unit_types" ty ON ty."code" IN ('COMPANY', 'LOCATION', 'AREA', 'POSITION', 'CONTRACT');

-- RLS ------------------------------------------------------------------------
ALTER TABLE "cfg_tenant_org_unit_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cfg_tenant_org_unit_types" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "dsh_dimensions"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dsh_dimensions"            FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "cfg_tenant_org_unit_types"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "dsh_dimensions"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Restaurar FORCE RLS en las tablas del backfill
ALTER TABLE "hr_org_units"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people"                 FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people_org_assignments" FORCE ROW LEVEL SECURITY;
