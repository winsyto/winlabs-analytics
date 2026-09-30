-- CreateTable
CREATE TABLE "int_templates" (
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "target_model" VARCHAR(40) NOT NULL,
    "config_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "int_templates_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "int_tenant_integrations" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_template_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "schedule_cron" VARCHAR(100),
    "config" JSONB NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "int_tenant_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_runs" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_integration_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "trigger_source" VARCHAR(20) NOT NULL,
    "triggered_by" VARCHAR(36),
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "rows_read" INTEGER NOT NULL DEFAULT 0,
    "rows_loaded" INTEGER NOT NULL DEFAULT 0,
    "rows_error" INTEGER NOT NULL DEFAULT 0,
    "rows_warning" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "int_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_run_errors" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" INTEGER NOT NULL,
    "row_index" INTEGER,
    "row_data" JSONB,
    "error_code" VARCHAR(50) NOT NULL,
    "error_message" TEXT NOT NULL,
    "severity" VARCHAR(10) NOT NULL DEFAULT 'error',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "int_run_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "int_tenant_integrations_tenant_id_integration_template_code_idx" ON "int_tenant_integrations"("tenant_id", "integration_template_code");

-- CreateIndex
CREATE INDEX "int_runs_tenant_id_tenant_integration_id_started_at_idx" ON "int_runs"("tenant_id", "tenant_integration_id", "started_at");

-- CreateIndex
CREATE INDEX "int_runs_tenant_id_status_idx" ON "int_runs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "int_run_errors_tenant_id_run_id_idx" ON "int_run_errors"("tenant_id", "run_id");

-- CreateIndex
CREATE INDEX "int_run_errors_tenant_id_run_id_severity_idx" ON "int_run_errors"("tenant_id", "run_id", "severity");

-- AddForeignKey
ALTER TABLE "int_tenant_integrations" ADD CONSTRAINT "int_tenant_integrations_integration_template_code_fkey" FOREIGN KEY ("integration_template_code") REFERENCES "int_templates"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_runs" ADD CONSTRAINT "int_runs_tenant_integration_id_fkey" FOREIGN KEY ("tenant_integration_id") REFERENCES "int_tenant_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_run_errors" ADD CONSTRAINT "int_run_errors_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "int_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- RLS — aislamiento por tenant (int_templates NO tiene RLS — catálogo global)
-- =============================================================================

ALTER TABLE "int_tenant_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "int_tenant_integrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "int_tenant_integrations"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "int_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "int_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "int_runs"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "int_run_errors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "int_run_errors" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "int_run_errors"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
