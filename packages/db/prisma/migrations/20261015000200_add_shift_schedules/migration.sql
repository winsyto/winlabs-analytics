-- =============================================================================
-- Horario de cada unidad organizativa de tipo SHIFT (turno).
-- work_week: 7 caracteres 0/1, lunes a domingo ("1111100" = lunes a viernes).
-- Una unidad SHIFT sin fila usa el horario por defecto del tenant (cfg_tenant_settings).
-- =============================================================================

CREATE TABLE "hr_shift_schedules" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "org_unit_id" INTEGER NOT NULL,
    "org_unit_type_code" TEXT NOT NULL DEFAULT 'SHIFT',
    "daily_hours" DECIMAL(4,2) NOT NULL,
    "weekly_hours" DECIMAL(5,2),
    "monthly_hours" DECIMAL(6,2),
    "work_week" CHAR(7) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_shift_schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "hr_shift_schedules_type_check" CHECK ("org_unit_type_code" = 'SHIFT'),
    CONSTRAINT "hr_shift_schedules_work_week_check" CHECK ("work_week" ~ '^[01]{7}$'),
    CONSTRAINT "hr_shift_schedules_daily_hours_check" CHECK ("daily_hours" > 0 AND "daily_hours" <= 24),
    CONSTRAINT "hr_shift_schedules_weekly_hours_check" CHECK ("weekly_hours" IS NULL OR ("weekly_hours" > 0 AND "weekly_hours" <= 168)),
    CONSTRAINT "hr_shift_schedules_monthly_hours_check" CHECK ("monthly_hours" IS NULL OR "monthly_hours" > 0)
);

CREATE UNIQUE INDEX "uq_hr_shift_schedules_org_unit" ON "hr_shift_schedules"("org_unit_id");
CREATE UNIQUE INDEX "uq_hr_shift_schedules_unit_type" ON "hr_shift_schedules"("org_unit_id", "org_unit_type_code");
CREATE INDEX "hr_shift_schedules_tenant_id_idx" ON "hr_shift_schedules"("tenant_id");

ALTER TABLE "hr_shift_schedules"
  ADD CONSTRAINT "hr_shift_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "hr_shift_schedules_org_unit_fkey" FOREIGN KEY ("org_unit_id", "org_unit_type_code") REFERENCES "hr_org_units"("id", "org_unit_type_code") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_shift_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_shift_schedules" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "hr_shift_schedules"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
