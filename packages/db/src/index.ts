export { prisma } from "./client";
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
