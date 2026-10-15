-- =============================================================================
-- Metas (benchmarks) por tenant para las métricas de los dashboards.
-- Sin fila para una métrica = se usa el valor por defecto del código (METRIC_TARGET_DEFAULTS).
-- unit: percent_monthly | percent_annual (la tasa de ausentismo es mensual; la rotación, anual).
-- =============================================================================

CREATE TABLE "cfg_tenant_metric_targets" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "metric_code" VARCHAR(50) NOT NULL,
    "target_value" DECIMAL(8,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cfg_tenant_metric_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cfg_tenant_metric_targets_metric_check" CHECK ("metric_code" IN ('absenteeism_rate', 'overtime_rate', 'turnover_rate')),
    CONSTRAINT "cfg_tenant_metric_targets_unit_check" CHECK ("unit" IN ('percent_monthly', 'percent_annual')),
    CONSTRAINT "cfg_tenant_metric_targets_value_check" CHECK ("target_value" >= 0 AND "target_value" <= 100)
);

CREATE UNIQUE INDEX "uq_cfg_tenant_metric_targets" ON "cfg_tenant_metric_targets"("tenant_id", "metric_code");

ALTER TABLE "cfg_tenant_metric_targets"
  ADD CONSTRAINT "cfg_tenant_metric_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cfg_tenant_metric_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cfg_tenant_metric_targets" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "cfg_tenant_metric_targets"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Backfill: meta de ausentismo por defecto (4% mensual) para los tenants existentes
ALTER TABLE "cfg_tenant_metric_targets" NO FORCE ROW LEVEL SECURITY;
INSERT INTO "cfg_tenant_metric_targets" ("tenant_id", "metric_code", "target_value", "unit", "updated_at")
SELECT "id", 'absenteeism_rate', 4.0, 'percent_monthly', now() FROM "tenants"
ON CONFLICT ("tenant_id", "metric_code") DO NOTHING;
ALTER TABLE "cfg_tenant_metric_targets" FORCE ROW LEVEL SECURITY;
