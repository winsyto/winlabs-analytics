export { prisma } from "./client";
export { Prisma } from "@prisma/client";
export { rebuildPeopleSnapshots } from "./snapshots/people-snapshots";
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
  TIME_ENTRY_CATEGORIES,
  TIME_ENTRY_TYPE_DEFAULTS,
  applyDefaultTimeEntryTypes,
} from "./time-entry-config";
export type { TimeEntryCategory } from "./time-entry-config";
export {
  DATA_MODULES,
  DASHBOARD_CATALOG,
  missingModules,
  upsertDashboardCatalog,
  applyDefaultDashboards,
} from "./dashboards-config";
export type { DataModuleCode } from "./dashboards-config";
export {
  PAY_CONCEPT_TYPES,
  PAY_PROCESS_TYPES,
  PAY_REFERENCE_TOTALS,
  PAY_CLASS_SIDES,
  PAY_CLASS_DEFAULTS,
  applyDefaultPayrollClasses,
} from "./payroll-config";
export type { PayConceptType, PayProcessType, PayReferenceTotal, PayClassSide } from "./payroll-config";
export {
  METRIC_TARGET_DEFAULTS,
  METRIC_CODES,
  ATTENDANCE_MODES,
  ABSENCE_DISPLAYS,
  OVERTIME_BASES,
  TENANT_SETTINGS_DEFAULTS,
  applyDefaultTenantSettings,
} from "./tenant-settings";
export type { MetricCode, AttendanceMode, AbsenceDisplay, OvertimeBase } from "./tenant-settings";
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
  CfgTenantTimeEntryType,
  CfgTenantOrgUnitType,
  DshDimension,
  CfgDashboard,
  DshTenantDashboard,
  // M1 — Time & Attendance
  AttTimeDaily,
  AttTimeDailyEntry,
  AttAbsenteeismEvent,
  // M1 — Payroll
  PayPeriod,
  PayProcess,
  PayConcept,
  PayConceptClass,
  PayClassRule,
  PayEntry,
  // M1-B — Integraciones
  IntTemplate,
  IntTenantIntegration,
  IntRun,
  IntRunError,
} from "@prisma/client";
