-- =============================================================================
-- Dashboard de Horas extras: base de la tasa por tenant y dimensiones.
-- overtime_base: scheduled = horas extra / horas programadas (por defecto); worked = / horas trabajadas.
-- Dimensiones: un tenant con las de ausentismo configuradas las hereda; los demás reciben las cinco por defecto.
-- =============================================================================

ALTER TABLE "cfg_tenant_settings" ADD COLUMN "overtime_base" VARCHAR(10) NOT NULL DEFAULT 'scheduled';
ALTER TABLE "cfg_tenant_settings" ADD CONSTRAINT "cfg_tenant_settings_overtime_base_check"
  CHECK ("overtime_base" IN ('scheduled', 'worked'));

ALTER TABLE "dsh_dimensions" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT "tenant_id", 'overtime', "org_unit_type_code", "sort_order"
FROM "dsh_dimensions"
WHERE "dashboard_code" = 'absenteeism'
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT te."id", 'overtime', ot."code", ot."sort_order"
FROM "tenants" te
CROSS JOIN "cfg_org_unit_types" ot
WHERE ot."code" IN ('COMPANY', 'LOCATION', 'AREA', 'POSITION', 'CONTRACT')
  AND NOT EXISTS (SELECT 1 FROM "dsh_dimensions" d WHERE d."tenant_id" = te."id" AND d."dashboard_code" = 'overtime')
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

ALTER TABLE "dsh_dimensions" FORCE ROW LEVEL SECURITY;
