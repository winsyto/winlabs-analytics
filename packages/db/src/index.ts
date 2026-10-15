export { prisma } from "./client";
export { Prisma } from "@prisma/client";
export {
  ORG_UNIT_TYPES,
  DEFAULT_DIMENSION_TYPES,
  DEFAULT_ENABLED_TYPES,
  DEFAULT_DASHBOARD_DIMENSIONS,
  DASHBOARD_CODES,
  applyDefaultOrgConfig,
} from "./org-config";
export type { DashboardCode } from "./org-config";
export {
  ABSENTEEISM_CLASSES,
  ABSENTEEISM_TYPE_DEFAULTS,
  applyDefaultAbsenteeismTypes,
} from "./absenteeism-config";
export type { AbsenteeismClass } from "./absenteeism-config";
export {
  METRIC_TARGET_DEFAULTS,
  METRIC_CODES,
  ATTENDANCE_MODES,
  ABSENCE_DISPLAYS,
  TENANT_SETTINGS_DEFAULTS,
  applyDefaultTenantSettings,
} from "./tenant-settings";
export type { MetricCode, AttendanceMode, AbsenceDisplay } from "./tenant-settings";
export type {
  Tenant,
  InternalUser,
  User,
  Role,
  UserRole,
  AuditLog,
  // M1 — Catálogos globales
  CfgOrgUnitType,
  CfgTerminationReason,
  CfgTimeEntryType,
  // M1 — People
  HrOrgUnit,
  HrPerson,
  HrPeopleOrgAssignment,
  HrPeopleHistory,
  HrShiftSchedule,
  CfgTenantSetting,
  CfgTenantMetricTarget,
  // M1 — Config por tenant
  CfgAbsenteeismType,
  CfgAbsenteeismTypeDefault,
  CfgTenantOrgUnitType,
  DshDimension,
  // M1 — Time & Attendance
  AttTimeDaily,
  AttTimeDailyEntry,
  AttAbsenteeismEvent,
  // M1 — Payroll
  PayPeriod,
  PayConcept,
  PayEntry,
  // M1-B — Integraciones
  IntTemplate,
  IntTenantIntegration,
  IntRun,
  IntRunError,
} from "@prisma/client";
