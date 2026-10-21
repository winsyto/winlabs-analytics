-- =============================================================================
-- Moneda del tenant (código ISO de 3 letras; una por tenant) y dimensiones del dashboard de Payroll.
-- Un tenant con las de Headcount configuradas las hereda; los demás reciben las cinco por defecto.
-- =============================================================================

ALTER TABLE "cfg_tenant_settings" ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'ARS';
ALTER TABLE "cfg_tenant_settings" ADD CONSTRAINT "cfg_tenant_settings_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "dsh_dimensions" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT "tenant_id", 'payroll', "org_unit_type_code", "sort_order"
FROM "dsh_dimensions"
WHERE "dashboard_code" = 'headcount'
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

INSERT INTO "dsh_dimensions" ("tenant_id", "dashboard_code", "org_unit_type_code", "sort_order")
SELECT te."id", 'payroll', ot."code", ot."sort_order"
FROM "tenants" te
CROSS JOIN "cfg_org_unit_types" ot
WHERE ot."code" IN ('COMPANY', 'LOCATION', 'AREA', 'POSITION', 'CONTRACT')
  AND NOT EXISTS (SELECT 1 FROM "dsh_dimensions" d WHERE d."tenant_id" = te."id" AND d."dashboard_code" = 'payroll')
ON CONFLICT ("tenant_id", "dashboard_code", "org_unit_type_code") DO NOTHING;

ALTER TABLE "dsh_dimensions" FORCE ROW LEVEL SECURITY;
