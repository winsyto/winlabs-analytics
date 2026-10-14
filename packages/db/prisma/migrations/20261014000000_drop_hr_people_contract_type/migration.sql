-- =============================================================================
-- Elimina hr_people.contract_type: el contrato es la unidad organizativa de tipo CONTRACT
-- (hr_people_org_assignments, con vigencia). La columna era un espejo transitorio.
-- Antes de eliminarla se asegura que toda persona con contract_type tenga su asignación CONTRACT.
-- =============================================================================

ALTER TABLE "hr_org_units"              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people"                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people_org_assignments" NO FORCE ROW LEVEL SECURITY;

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
WHERE p."contract_type" IS NOT NULL
  AND p."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "hr_people_org_assignments" a
    WHERE a."person_id" = p."id" AND a."org_unit_type_code" = 'CONTRACT'
  )
ON CONFLICT ("tenant_id", "org_unit_type_code", "code") DO NOTHING;

INSERT INTO "hr_people_org_assignments"
  ("tenant_id", "person_id", "org_unit_id", "org_unit_type_code", "valid_from", "valid_to")
SELECT p."tenant_id", p."id", ou."id", 'CONTRACT', p."hire_date",
  CASE WHEN p."termination_date" IS NULL THEN NULL ELSE GREATEST(p."termination_date", p."hire_date") END
FROM "hr_people" p
JOIN "hr_org_units" ou
  ON ou."tenant_id" = p."tenant_id" AND ou."org_unit_type_code" = 'CONTRACT' AND ou."code" = p."contract_type"
WHERE p."contract_type" IS NOT NULL
  AND p."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "hr_people_org_assignments" a
    WHERE a."person_id" = p."id" AND a."org_unit_type_code" = 'CONTRACT'
  )
ON CONFLICT DO NOTHING;

ALTER TABLE "hr_people" DROP COLUMN "contract_type";

ALTER TABLE "hr_org_units"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people"                 FORCE ROW LEVEL SECURITY;
ALTER TABLE "hr_people_org_assignments" FORCE ROW LEVEL SECURITY;
