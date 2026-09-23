-- CreateTable
CREATE TABLE "cfg_org_unit_types" (
    "code" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cfg_org_unit_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "cfg_termination_reasons" (
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cfg_termination_reasons_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "cfg_time_entry_types" (
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "sign" SMALLINT NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cfg_time_entry_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "hr_org_units" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "org_unit_type_code" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "parent_org_unit_id" INTEGER,
    "level" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_org_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_people" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_code" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "email" VARCHAR(255),
    "birth_date" DATE,
    "gender" VARCHAR(20),
    "nationality" VARCHAR(100),
    "document_type" VARCHAR(30),
    "document_number" VARCHAR(50),
    "hire_date" DATE NOT NULL,
    "termination_date" DATE,
    "termination_reason_code" TEXT,
    "status" VARCHAR(20) NOT NULL,
    "contract_type" VARCHAR(30),
    "manager_id" INTEGER,
    "salary_band" VARCHAR(50),
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_people_org_assignments" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "person_id" INTEGER NOT NULL,
    "org_unit_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_people_org_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_people_history" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "person_id" INTEGER NOT NULL,
    "employee_code" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "org_assignments_snapshot" JSONB,
    "manager_id" INTEGER,
    "salary_band" VARCHAR(50),
    "tenure_months" INTEGER,
    "custom_fields_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_people_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfg_absenteeism_types" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "counts_as_absence" BOOLEAN NOT NULL DEFAULT true,
    "custom_fields" JSONB,

    CONSTRAINT "cfg_absenteeism_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "att_time_daily" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "person_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "is_working_day" BOOLEAN NOT NULL,
    "scheduled_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "worked_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "has_absence" BOOLEAN NOT NULL DEFAULT false,
    "source_integration_id" INTEGER,
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "att_time_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "att_time_daily_entries" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "time_daily_id" INTEGER NOT NULL,
    "time_entry_type_code" TEXT NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "att_time_daily_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "att_absenteeism_events" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "person_id" INTEGER NOT NULL,
    "absenteeism_type_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_count" DECIMAL(5,2) NOT NULL,
    "hours_count" DECIMAL(6,2) NOT NULL,
    "justified" BOOLEAN NOT NULL DEFAULT false,
    "cost_estimated" DECIMAL(12,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "source_integration_id" INTEGER,
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "att_absenteeism_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_code" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_concepts" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "sign" SMALLINT NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "custom_fields" JSONB,

    CONSTRAINT "pay_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_entries" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "concept_id" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "hours" DECIMAL(6,2),
    "source_integration_id" INTEGER,
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cfg_org_unit_types_code_key" ON "cfg_org_unit_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_termination_reasons_code_key" ON "cfg_termination_reasons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_time_entry_types_code_key" ON "cfg_time_entry_types"("code");

-- CreateIndex
CREATE INDEX "hr_org_units_tenant_id_org_unit_type_code_idx" ON "hr_org_units"("tenant_id", "org_unit_type_code");

-- CreateIndex
CREATE INDEX "hr_org_units_parent_org_unit_id_idx" ON "hr_org_units"("parent_org_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_org_units_tenant_id_org_unit_type_code_code_key" ON "hr_org_units"("tenant_id", "org_unit_type_code", "code");

-- CreateIndex
CREATE INDEX "hr_people_tenant_id_status_idx" ON "hr_people"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "hr_people_tenant_id_hire_date_idx" ON "hr_people"("tenant_id", "hire_date");

-- CreateIndex
CREATE INDEX "hr_people_manager_id_idx" ON "hr_people"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_people_tenant_id_employee_code_key" ON "hr_people"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "hr_people_org_assignments_tenant_id_org_unit_id_idx" ON "hr_people_org_assignments"("tenant_id", "org_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_people_org_assignments_tenant_id_person_id_org_unit_id_key" ON "hr_people_org_assignments"("tenant_id", "person_id", "org_unit_id");

-- CreateIndex
CREATE INDEX "hr_people_history_tenant_id_snapshot_date_idx" ON "hr_people_history"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "hr_people_history_tenant_id_person_id_idx" ON "hr_people_history"("tenant_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_people_history_tenant_id_snapshot_date_person_id_key" ON "hr_people_history"("tenant_id", "snapshot_date", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_absenteeism_types_tenant_id_code_key" ON "cfg_absenteeism_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "att_time_daily_tenant_id_date_idx" ON "att_time_daily"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "att_time_daily_tenant_id_person_id_date_key" ON "att_time_daily"("tenant_id", "person_id", "date");

-- CreateIndex
CREATE INDEX "att_time_daily_entries_tenant_id_time_entry_type_code_idx" ON "att_time_daily_entries"("tenant_id", "time_entry_type_code");

-- CreateIndex
CREATE UNIQUE INDEX "att_time_daily_entries_tenant_id_time_daily_id_time_entry_t_key" ON "att_time_daily_entries"("tenant_id", "time_daily_id", "time_entry_type_code");

-- CreateIndex
CREATE INDEX "att_absenteeism_events_tenant_id_person_id_start_date_idx" ON "att_absenteeism_events"("tenant_id", "person_id", "start_date");

-- CreateIndex
CREATE INDEX "att_absenteeism_events_tenant_id_absenteeism_type_id_idx" ON "att_absenteeism_events"("tenant_id", "absenteeism_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_tenant_id_period_code_key" ON "pay_periods"("tenant_id", "period_code");

-- CreateIndex
CREATE UNIQUE INDEX "pay_concepts_tenant_id_code_key" ON "pay_concepts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "pay_entries_tenant_id_period_id_person_id_idx" ON "pay_entries"("tenant_id", "period_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_entries_tenant_id_period_id_person_id_concept_id_key" ON "pay_entries"("tenant_id", "period_id", "person_id", "concept_id");

-- AddForeignKey
ALTER TABLE "hr_org_units" ADD CONSTRAINT "hr_org_units_org_unit_type_code_fkey" FOREIGN KEY ("org_unit_type_code") REFERENCES "cfg_org_unit_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_org_units" ADD CONSTRAINT "hr_org_units_parent_org_unit_id_fkey" FOREIGN KEY ("parent_org_unit_id") REFERENCES "hr_org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_people" ADD CONSTRAINT "hr_people_termination_reason_code_fkey" FOREIGN KEY ("termination_reason_code") REFERENCES "cfg_termination_reasons"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_people" ADD CONSTRAINT "hr_people_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "hr_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_people_org_assignments" ADD CONSTRAINT "hr_people_org_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hr_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_people_org_assignments" ADD CONSTRAINT "hr_people_org_assignments_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "hr_org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_people_history" ADD CONSTRAINT "hr_people_history_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hr_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "att_time_daily" ADD CONSTRAINT "att_time_daily_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hr_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "att_time_daily_entries" ADD CONSTRAINT "att_time_daily_entries_time_daily_id_fkey" FOREIGN KEY ("time_daily_id") REFERENCES "att_time_daily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "att_time_daily_entries" ADD CONSTRAINT "att_time_daily_entries_time_entry_type_code_fkey" FOREIGN KEY ("time_entry_type_code") REFERENCES "cfg_time_entry_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "att_absenteeism_events" ADD CONSTRAINT "att_absenteeism_events_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hr_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "att_absenteeism_events" ADD CONSTRAINT "att_absenteeism_events_absenteeism_type_id_fkey" FOREIGN KEY ("absenteeism_type_id") REFERENCES "cfg_absenteeism_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_entries" ADD CONSTRAINT "pay_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_entries" ADD CONSTRAINT "pay_entries_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hr_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_entries" ADD CONSTRAINT "pay_entries_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "pay_concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- RLS — Row Level Security para tablas con tenant_id
-- cfg_org_unit_types, cfg_termination_reasons, cfg_time_entry_types: sin RLS (globales)
-- FORCE RLS aplica incluso al owner de la tabla (wla_dev en local)
-- =============================================================================

ALTER TABLE "hr_org_units"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_org_units"             FORCE  ROW LEVEL SECURITY;
ALTER TABLE "hr_people"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_people"                FORCE  ROW LEVEL SECURITY;
ALTER TABLE "hr_people_org_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_people_org_assignments" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "hr_people_history"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_people_history"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "cfg_absenteeism_types"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cfg_absenteeism_types"    FORCE  ROW LEVEL SECURITY;
ALTER TABLE "att_time_daily"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "att_time_daily"           FORCE  ROW LEVEL SECURITY;
ALTER TABLE "att_time_daily_entries"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "att_time_daily_entries"   FORCE  ROW LEVEL SECURITY;
ALTER TABLE "att_absenteeism_events"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "att_absenteeism_events"   FORCE  ROW LEVEL SECURITY;
ALTER TABLE "pay_periods"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_periods"              FORCE  ROW LEVEL SECURITY;
ALTER TABLE "pay_concepts"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_concepts"             FORCE  ROW LEVEL SECURITY;
ALTER TABLE "pay_entries"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_entries"              FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "hr_org_units"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "hr_people"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "hr_people_org_assignments"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "hr_people_history"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "cfg_absenteeism_types"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "att_time_daily"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "att_time_daily_entries"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "att_absenteeism_events"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "pay_periods"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "pay_concepts"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON "pay_entries"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
