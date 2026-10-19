import type { Prisma } from "@prisma/client";

/** Métricas con meta configurable por tenant y su valor por defecto (si el tenant no tiene fila). */
export const METRIC_TARGET_DEFAULTS = {
  absenteeism_rate: { value: 4, unit: "percent_monthly" },
  overtime_rate: { value: 10, unit: "percent_monthly" },
  turnover_rate: { value: 18, unit: "percent_annual" },
} as const;

export type MetricCode = keyof typeof METRIC_TARGET_DEFAULTS;
export const METRIC_CODES = Object.keys(METRIC_TARGET_DEFAULTS) as MetricCode[];

export const ATTENDANCE_MODES = ["basic", "detailed"] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

export const ABSENCE_DISPLAYS = ["hours", "days", "both"] as const;
export type AbsenceDisplay = (typeof ABSENCE_DISPLAYS)[number];

/** Base de la tasa de horas extra: horas programadas (por defecto) u horas trabajadas. */
export const OVERTIME_BASES = ["scheduled", "worked"] as const;
export type OvertimeBase = (typeof OVERTIME_BASES)[number];

/** Valores por defecto de cfg_tenant_settings (los mismos que las columnas de la tabla). */
export const TENANT_SETTINGS_DEFAULTS = {
  attendanceMode: "basic" as AttendanceMode,
  defaultWorkWeek: "1111100",
  defaultDailyHours: 8,
  absenceDisplay: "both" as AbsenceDisplay,
  overtimeBase: "scheduled" as OvertimeBase,
};

/**
 * Crea (idempotente) la configuración por defecto del tenant: ajustes de asistencia y meta de
 * ausentismo. No pisa valores existentes. Debe ejecutarse dentro de withTenantContext(tenantId, ...).
 */
export async function applyDefaultTenantSettings(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  await tx.cfgTenantSetting.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });
  const d = METRIC_TARGET_DEFAULTS.absenteeism_rate;
  await tx.cfgTenantMetricTarget.upsert({
    where: { uq_cfg_tenant_metric_targets: { tenantId, metricCode: "absenteeism_rate" } },
    update: {},
    create: { tenantId, metricCode: "absenteeism_rate", targetValue: d.value, unit: d.unit },
  });
}
