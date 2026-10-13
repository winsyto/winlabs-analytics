export { prisma } from "./client";
export { Prisma } from "@prisma/client";
export {
  ORG_UNIT_TYPES,
  DEFAULT_DIMENSION_TYPES,
  DASHBOARD_CODES,
  applyDefaultOrgConfig,
} from "./org-config";
export type { DashboardCode } from "./org-config";
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
  // M1 — Config por tenant
  CfgAbsenteeismType,
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
