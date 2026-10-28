-- =============================================================================
-- Hub de dashboards.
--  cfg_dashboards:       catálogo global de dashboards (código, nombre, ruta y módulos de datos que requieren).
--  dsh_tenant_dashboards: qué dashboards tiene activos cada tenant. allowed_roles queda preparado para permisos por
--                         opción de menú (hoy no se usa: lo ven todos los roles).
-- Los tenants existentes quedan con todos los dashboards activos (no cambia nada para ellos).
-- =============================================================================

CREATE TABLE "cfg_dashboards" (
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "route" VARCHAR(100) NOT NULL,
    "required_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cfg_dashboards_pkey" PRIMARY KEY ("code")
);

INSERT INTO "cfg_dashboards" ("code", "name", "description", "route", "required_modules", "sort_order", "updated_at") VALUES
  ('headcount',   'Headcount',    'Dotación, altas, bajas y distribución por unidad',                        '/headcount',   ARRAY['people'],            1, now()),
  ('absenteeism', 'Ausentismos',  'Tasa de ausentismo contra la meta, por clase, tipo y unidad',             '/absenteeism', ARRAY['people','time'],     2, now()),
  ('overtime',    'Horas extras', 'Tasa de horas extra contra la meta, por tipo y unidad',                   '/overtime',    ARRAY['people','time'],     3, now()),
  ('turnover',    'Rotación',     'Rotación contra la meta anual, por motivo, antigüedad y unidad',          '/turnover',    ARRAY['people'],            4, now()),
  ('payroll',     'Payroll',      'Masa salarial, costo por persona, composición por clase y por concepto',  '/payroll',     ARRAY['people','payroll'], 5, now());

CREATE TABLE "dsh_tenant_dashboards" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dashboard_code" VARCHAR(50) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowed_roles" TEXT[] NOT NULL DEFAULT ARRAY['admin','analyst','viewer']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsh_tenant_dashboards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_dsh_tenant_dashboards" ON "dsh_tenant_dashboards"("tenant_id", "dashboard_code");
-- La clave foránea necesita un índice que empiece por su columna
CREATE INDEX "dsh_tenant_dashboards_dashboard_code_idx" ON "dsh_tenant_dashboards"("dashboard_code");

ALTER TABLE "dsh_tenant_dashboards"
  ADD CONSTRAINT "dsh_tenant_dashboards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dsh_tenant_dashboards"
  ADD CONSTRAINT "dsh_tenant_dashboards_dashboard_code_fkey" FOREIGN KEY ("dashboard_code") REFERENCES "cfg_dashboards"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dsh_tenant_dashboards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dsh_tenant_dashboards" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "dsh_tenant_dashboards"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Los tenants existentes conservan todos los dashboards
ALTER TABLE "dsh_tenant_dashboards" NO FORCE ROW LEVEL SECURITY;
INSERT INTO "dsh_tenant_dashboards" ("tenant_id", "dashboard_code", "updated_at")
SELECT t."id", d."code", now() FROM "tenants" t CROSS JOIN "cfg_dashboards" d;
ALTER TABLE "dsh_tenant_dashboards" FORCE ROW LEVEL SECURITY;
