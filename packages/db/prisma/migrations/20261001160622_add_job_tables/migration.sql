-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" INTEGER,
    "job_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "run_key" VARCHAR(200),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "locked_by" VARCHAR(100),
    "heartbeat_at" TIMESTAMP(3),
    "progress_current" INTEGER NOT NULL DEFAULT 0,
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "progress_message" TEXT,
    "last_error" TEXT,
    "last_error_code" VARCHAR(50),
    "created_by" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "worker_id" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" BIGINT,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "error_code" VARCHAR(50),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "job_run_id" INTEGER,
    "tenant_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "level" VARCHAR(10) NOT NULL DEFAULT 'info',
    "message" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_checkpoints" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" INTEGER NOT NULL,
    "checkpoint_type" VARCHAR(50) NOT NULL,
    "checkpoint_value" TEXT,
    "checkpoint_data" JSONB NOT NULL DEFAULT '{}',
    "last_success_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_jobs_status_scheduled" ON "jobs"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "idx_jobs_tenant_status" ON "jobs"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_tenant_id_integration_id_job_type_run_key_key" ON "jobs"("tenant_id", "integration_id", "job_type", "run_key");

-- CreateIndex
CREATE INDEX "idx_job_runs_job_id" ON "job_runs"("job_id");

-- CreateIndex
CREATE INDEX "idx_job_runs_tenant_status" ON "job_runs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_job_events_job_created" ON "job_events"("job_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_job_events_tenant_created" ON "job_events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_job_checkpoints_tenant_integration" ON "job_checkpoints"("tenant_id", "integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_checkpoints_tenant_id_integration_id_checkpoint_type_key" ON "job_checkpoints"("tenant_id", "integration_id", "checkpoint_type");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "int_tenant_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_run_id_fkey" FOREIGN KEY ("job_run_id") REFERENCES "job_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_checkpoints" ADD CONSTRAINT "job_checkpoints_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "int_tenant_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
