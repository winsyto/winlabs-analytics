-- =============================================================================
-- Configuración de asistencia y visualización por tenant (una fila por tenant).
-- attendance_mode: basic = el horario sale de las unidades SHIFT; detailed = asistencia diaria (API, pendiente).
-- default_work_week / default_daily_hours: horario de quien no tiene turno asignado.
-- absence_display: cómo muestran los dashboards las ausencias (horas, días o ambas).
-- =============================================================================

CREATE TABLE "cfg_tenant_settings" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attendance_mode" VARCHAR(20) NOT NULL DEFAULT 'basic',
    "default_work_week" CHAR(7) NOT NULL DEFAULT '1111100',
    "default_daily_hours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "absence_display" VARCHAR(10) NOT NULL DEFAULT 'both',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cfg_tenant_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cfg_tenant_settings_attendance_mode_check" CHECK ("attendance_mode" IN ('basic', 'detailed')),
    CONSTRAINT "cfg_tenant_settings_work_week_check" CHECK ("default_work_week" ~ '^[01]{7}$'),
    CONSTRAINT "cfg_tenant_settings_daily_hours_check" CHECK ("default_daily_hours" > 0 AND "default_daily_hours" <= 24),
    CONSTRAINT "cfg_tenant_settings_absence_display_check" CHECK ("absence_display" IN ('hours', 'days', 'both'))
);

CREATE UNIQUE INDEX "uq_cfg_tenant_settings_tenant" ON "cfg_tenant_settings"("tenant_id");

ALTER TABLE "cfg_tenant_settings"
  ADD CONSTRAINT "cfg_tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cfg_tenant_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cfg_tenant_settings" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "cfg_tenant_settings"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Backfill: una fila con los valores por defecto para cada tenant existente
ALTER TABLE "cfg_tenant_settings" NO FORCE ROW LEVEL SECURITY;
INSERT INTO "cfg_tenant_settings" ("tenant_id", "updated_at")
SELECT "id", now() FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;
ALTER TABLE "cfg_tenant_settings" FORCE ROW LEVEL SECURITY;
