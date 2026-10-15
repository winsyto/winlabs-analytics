-- =============================================================================
-- Catálogo global de tipos de ausencia por defecto (sin RLS) + copia a los tenants existentes.
-- Los tenants nuevos lo heredan con applyDefaultAbsenteeismTypes (al crearse en el CMP).
-- El catálogo se mantiene después con db:seed:prod-catalog (idempotente).
-- =============================================================================

CREATE TABLE "cfg_absenteeism_type_defaults" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "class" VARCHAR(30) NOT NULL,
    "counts_as_absence" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cfg_absenteeism_type_defaults_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cfg_absenteeism_type_defaults_class_check"
      CHECK ("class" IN ('medical','accident','unpaid','unjustified','suspension','personal','other','vacation','legal_leave','day_off'))
);

CREATE UNIQUE INDEX "cfg_absenteeism_type_defaults_code_key" ON "cfg_absenteeism_type_defaults"("code");

INSERT INTO "cfg_absenteeism_type_defaults" ("code", "name", "class", "counts_as_absence", "sort_order") VALUES
  ('ENFERMEDAD',           'Enfermedad',                  'medical',     true,  1),
  ('ENFERMEDAD_FAMILIAR',  'Enfermedad de familiar',      'personal',    true,  2),
  ('ACCIDENTE_TRABAJO',    'Accidente de trabajo / ART',  'accident',    true,  3),
  ('SIN_GOCE',             'Sin goce de haberes',         'unpaid',      true,  4),
  ('SIN_AVISO',            'Ausencia sin aviso',          'unjustified', true,  5),
  ('SUSPENSION',           'Suspensión',                  'suspension',  true,  6),
  ('MUDANZA',              'Mudanza',                     'personal',    true,  7),
  ('VACACIONES',           'Vacaciones',                  'vacation',    false, 8),
  ('MATERNIDAD',           'Licencia por maternidad',     'legal_leave', false, 9),
  ('PATERNIDAD',           'Licencia por paternidad',     'legal_leave', false, 10),
  ('MATRIMONIO',           'Licencia por matrimonio',     'legal_leave', false, 11),
  ('FALLECIMIENTO',        'Licencia por fallecimiento',  'legal_leave', false, 12),
  ('EXAMEN',               'Licencia por examen',         'legal_leave', false, 13),
  ('FRANCO_COMPENSATORIO', 'Franco compensatorio',        'day_off',     false, 14);

-- Backfill entre tenants (la tabla tiene FORCE RLS)
ALTER TABLE "cfg_absenteeism_types" NO FORCE ROW LEVEL SECURITY;

-- Tipos creados por archivo y sin clasificar cuyo código coincide con un default: toman su clasificación
UPDATE "cfg_absenteeism_types" t
SET "class" = d."class",
    "counts_as_absence" = d."counts_as_absence",
    "name" = CASE WHEN t."name" = t."code" THEN d."name" ELSE t."name" END,
    "is_classified" = true
FROM "cfg_absenteeism_type_defaults" d
WHERE t."code" = d."code" AND t."is_classified" = false;

-- Cada tenant recibe los tipos por defecto que todavía no tiene (sin pisar los existentes)
INSERT INTO "cfg_absenteeism_types" ("tenant_id", "code", "name", "class", "counts_as_absence", "is_classified")
SELECT te."id", d."code", d."name", d."class", d."counts_as_absence", true
FROM "tenants" te
CROSS JOIN "cfg_absenteeism_type_defaults" d
ON CONFLICT ("tenant_id", "code") DO NOTHING;

ALTER TABLE "cfg_absenteeism_types" FORCE ROW LEVEL SECURITY;
