-- =============================================================================
-- Dimensiones del dashboard de ausentismos y tipo SHIFT habilitado (opcional) en todos los tenants.
-- Un tenant con dimensiones de headcount configuradas hereda esas mismas para ausentismos;
-- los demás reciben las cinco por defecto (COMPANY, LOCATION, AREA, POSITION, CONTRACT).
-- =============================================================================

ALTER TABLE "dsh_dimensions"            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "cfg_tenant_org_unit_types" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT "tenant_id", 'absenteeism', "org_unit_type_code", "sort_order"
FROM "dsh_dimensions"
WHERE "dashboard_code" = 'headcount'
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT te."id", 'absenteeism', ot."code", ot."sort_order"
FROM "tenants" te
CROSS JOIN "cfg_org_unit_types" ot
WHERE ot."code" IN ('COMPANY', 'LOCATION', 'AREA', 'POSITION', 'CONTRACT')
  AND NOT EXISTS (SELECT 1 FROM "dsh_dimensions" d WHERE d."tenant_id" = te."id" AND d."dashboard_code" = 'absenteeism')
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

-- SHIFT habilitado (no es dimensión por defecto): permite administrar turnos y cargar shift_code
INSERT INTO "cfg_tenant_org_unit_types" ("tenant_id", "org_unit_type_code", "is_enabled", "sort_order", "updated_at")
SELECT te."id", ot."code", true, ot."sort_order", now()
FROM "tenants" te
CROSS JOIN "cfg_org_unit_types" ot
WHERE ot."code" = 'SHIFT'
ON CONFLICT ("tenant_id", "org_unit_type_code") DO UPDATE SET "is_enabled" = true;

ALTER TABLE "dsh_dimensions"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "cfg_tenant_org_unit_types" FORCE ROW LEVEL SECURITY;
