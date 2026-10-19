-- =============================================================================
-- La autorización de una hora extra pasa de columna (is_authorized) a categoría:
-- 'overtime_na' = hora extra no autorizada para el pago. Solo la categoría 'overtime' forma la tasa;
-- 'overtime_na' se muestra aparte en el dashboard de Horas extras.
-- =============================================================================

-- Catálogo global
ALTER TABLE "cfg_time_entry_types" DROP CONSTRAINT "cfg_time_entry_types_category_check";
ALTER TABLE "cfg_time_entry_types" ADD CONSTRAINT "cfg_time_entry_types_category_check"
  CHECK ("category" IN ('regular', 'overtime', 'overtime_na', 'training', 'holiday', 'absence', 'other'));
UPDATE "cfg_time_entry_types" SET "category" = 'overtime_na' WHERE "is_authorized" = false;
ALTER TABLE "cfg_time_entry_types" DROP COLUMN "is_authorized";

-- Tipos por tenant (FORCE RLS: se suspende para actualizar entre tenants)
ALTER TABLE "cfg_tenant_time_entry_types" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "cfg_tenant_time_entry_types" DROP CONSTRAINT "cfg_tenant_time_entry_types_category_check";
ALTER TABLE "cfg_tenant_time_entry_types" ADD CONSTRAINT "cfg_tenant_time_entry_types_category_check"
  CHECK ("category" IN ('regular', 'overtime', 'overtime_na', 'training', 'holiday', 'absence', 'other'));
-- Un tipo que el admin dejó como hora extra autorizada conserva su categoría; solo cambian los marcados como no autorizados
UPDATE "cfg_tenant_time_entry_types" SET "category" = 'overtime_na'
WHERE "category" = 'overtime' AND "is_authorized" = false;
ALTER TABLE "cfg_tenant_time_entry_types" DROP COLUMN "is_authorized";
ALTER TABLE "cfg_tenant_time_entry_types" FORCE ROW LEVEL SECURITY;
