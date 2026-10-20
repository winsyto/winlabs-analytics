-- =============================================================================
-- Dimensiones del dashboard de Rotación. Un tenant con las de Headcount configuradas las hereda;
-- los demás reciben las cinco por defecto (COMPANY, LOCATION, AREA, POSITION, CONTRACT).
-- =============================================================================

ALTER TABLE "dsh_dimensions" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT "tenant_id", 'turnover', "org_unit_type_code", "sort_order"
FROM "dsh_dimensions"
WHERE "dashboard_code" = 'headcount'
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT te."id", 'turnover', ot."code", ot."sort_order"
FROM "tenants" te
CROSS JOIN "cfg_org_unit_types" ot
WHERE ot."code" IN ('COMPANY', 'LOCATION', 'AREA', 'POSITION', 'CONTRACT')
  AND NOT EXISTS (SELECT 1 FROM "dsh_dimensions" d WHERE d."tenant_id" = te."id" AND d."dashboard_code" = 'turnover')
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

ALTER TABLE "dsh_dimensions" FORCE ROW LEVEL SECURITY;
