/**
 * Test de aislamiento RLS.
 *
 * Verifica que withTenantContext(tenantId) garantiza que las queries
 * retornan únicamente filas del tenant correcto — nunca filas de otro tenant.
 *
 * Requiere BD PostgreSQL real con RLS activo (winlabs_analytics_test).
 * NO usa mocks — los mocks no validan políticas de Postgres.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../client";
import { withTenantContext } from "../test-helpers/tenant-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestTenant(slug: string) {
  return prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: { slug, name: `Test Tenant ${slug}` },
  });
}

async function createTestRole(tenantId: string, name: string) {
  return withTenantContext(tenantId, (tx) =>
    tx.role.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name, description: `Role ${name}` },
    })
  );
}

async function createTestUser(tenantId: string, email: string, name: string) {
  return withTenantContext(tenantId, (tx) =>
    tx.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: {},
      create: {
        tenantId,
        email,
        name,
        passwordHash: "$2a$10$placeholder_hash_for_tests_only_xxxxx",
      },
    })
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let tenantAlphaId: string;
let tenantBetaId: string;

beforeAll(async () => {
  const alpha = await createTestTenant("rls-test-alpha");
  const beta = await createTestTenant("rls-test-beta");

  tenantAlphaId = alpha.id;
  tenantBetaId = beta.id;

  await createTestRole(tenantAlphaId, "admin");
  await createTestRole(tenantBetaId, "admin");

  await createTestUser(tenantAlphaId, "alice@alpha.test", "Alice Alpha");
  await createTestUser(tenantAlphaId, "bob@alpha.test", "Bob Alpha");
  await createTestUser(tenantBetaId, "charlie@beta.test", "Charlie Beta");
});

afterAll(async () => {
  await withTenantContext(tenantAlphaId, (tx) =>
    tx.userRole.deleteMany({ where: { tenantId: tenantAlphaId } })
  );
  await withTenantContext(tenantBetaId, (tx) =>
    tx.userRole.deleteMany({ where: { tenantId: tenantBetaId } })
  );
  await withTenantContext(tenantAlphaId, (tx) =>
    tx.user.deleteMany({ where: { tenantId: tenantAlphaId } })
  );
  await withTenantContext(tenantBetaId, (tx) =>
    tx.user.deleteMany({ where: { tenantId: tenantBetaId } })
  );
  await withTenantContext(tenantAlphaId, (tx) =>
    tx.role.deleteMany({ where: { tenantId: tenantAlphaId } })
  );
  await withTenantContext(tenantBetaId, (tx) =>
    tx.role.deleteMany({ where: { tenantId: tenantBetaId } })
  );
  await prisma.tenant.deleteMany({
    where: { slug: { in: ["rls-test-alpha", "rls-test-beta"] } },
  });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers M1
// ---------------------------------------------------------------------------

async function seedOrgUnitType(code: string, name: string) {
  return prisma.cfgOrgUnitType.upsert({
    where: { code },
    update: {},
    create: { code, name, isActive: true },
  });
}

async function createTestOrgUnit(
  tenantId: string,
  typeCode: string,
  code: string,
  name: string
) {
  return withTenantContext(tenantId, (tx) =>
    tx.hrOrgUnit.upsert({
      where: { uq_hr_org_units_tenant_type_code: { tenantId, orgUnitTypeCode: typeCode, code } },
      update: {},
      create: { tenantId, orgUnitTypeCode: typeCode, code, name, isActive: true },
    })
  );
}

async function createTestPerson(tenantId: string, employeeCode: string, fullName: string) {
  return withTenantContext(tenantId, (tx) =>
    tx.hrPerson.upsert({
      where: { uq_hr_people_tenant_code: { tenantId, employeeCode } },
      update: {},
      create: { tenantId, employeeCode, fullName, hireDate: new Date("2024-01-01"), status: "active" },
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RLS — aislamiento entre tenants", () => {
  it("tenant Alpha solo ve sus propios usuarios", async () => {
    const users = await withTenantContext(tenantAlphaId, (tx) =>
      tx.user.findMany()
    );

    const emails = users.map((u) => u.email);
    expect(emails).toContain("alice@alpha.test");
    expect(emails).toContain("bob@alpha.test");
    expect(emails).not.toContain("charlie@beta.test");
  });

  it("tenant Beta solo ve sus propios usuarios", async () => {
    const users = await withTenantContext(tenantBetaId, (tx) =>
      tx.user.findMany()
    );

    const emails = users.map((u) => u.email);
    expect(emails).toContain("charlie@beta.test");
    expect(emails).not.toContain("alice@alpha.test");
    expect(emails).not.toContain("bob@alpha.test");
  });

  it("contexto Alpha no puede leer roles de Beta aunque los pida explícitamente", async () => {
    const roles = await withTenantContext(tenantAlphaId, (tx) =>
      // Intenta filtrar por el tenantId de Beta — RLS lo bloquea
      tx.role.findMany({ where: { tenantId: tenantBetaId } })
    );

    expect(roles).toHaveLength(0);
  });

  it("contexto Beta no puede leer roles de Alpha aunque los pida explícitamente", async () => {
    const roles = await withTenantContext(tenantBetaId, (tx) =>
      tx.role.findMany({ where: { tenantId: tenantAlphaId } })
    );

    expect(roles).toHaveLength(0);
  });

  it("tenant Alpha ve exactamente 2 usuarios (ni más ni menos)", async () => {
    const users = await withTenantContext(tenantAlphaId, (tx) =>
      tx.user.findMany()
    );

    expect(users).toHaveLength(2);
  });

  it("tenant Beta ve exactamente 1 usuario", async () => {
    const users = await withTenantContext(tenantBetaId, (tx) =>
      tx.user.findMany()
    );

    expect(users).toHaveLength(1);
  });
});

describe("RLS M1 — hr_org_units y hr_people", () => {
  beforeAll(async () => {
    await seedOrgUnitType("AREA", "Área");
    await createTestOrgUnit(tenantAlphaId, "AREA", "VENTAS", "Ventas Alpha");
    await createTestOrgUnit(tenantBetaId, "AREA", "VENTAS", "Ventas Beta");
    await createTestPerson(tenantAlphaId, "EMP-A-001", "Alice Empleada");
    await createTestPerson(tenantBetaId, "EMP-B-001", "Charlie Empleado");
  });

  afterAll(async () => {
    await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrPerson.deleteMany({ where: { tenantId: tenantAlphaId } })
    );
    await withTenantContext(tenantBetaId, (tx) =>
      tx.hrPerson.deleteMany({ where: { tenantId: tenantBetaId } })
    );
    await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrOrgUnit.deleteMany({ where: { tenantId: tenantAlphaId } })
    );
    await withTenantContext(tenantBetaId, (tx) =>
      tx.hrOrgUnit.deleteMany({ where: { tenantId: tenantBetaId } })
    );
  });

  it("tenant Alpha solo ve sus propias org units", async () => {
    const units = await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrOrgUnit.findMany()
    );
    expect(units).toHaveLength(1);
    expect(units[0]?.name).toBe("Ventas Alpha");
  });

  it("tenant Beta solo ve sus propias org units", async () => {
    const units = await withTenantContext(tenantBetaId, (tx) =>
      tx.hrOrgUnit.findMany()
    );
    expect(units).toHaveLength(1);
    expect(units[0]?.name).toBe("Ventas Beta");
  });

  it("tenant Alpha solo ve sus propias personas", async () => {
    const people = await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrPerson.findMany()
    );
    expect(people).toHaveLength(1);
    expect(people[0]?.employeeCode).toBe("EMP-A-001");
  });

  it("contexto Alpha no puede leer personas de Beta aunque las pida explícitamente", async () => {
    const people = await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrPerson.findMany({ where: { tenantId: tenantBetaId } })
    );
    expect(people).toHaveLength(0);
  });
});

describe("RLS M1-B — int_tenant_integrations, int_runs, int_run_errors", () => {
  let integrationAlphaId: number;
  let integrationBetaId: number;
  let runAlphaId: number;

  beforeAll(async () => {
    // Aseguramos que el template global exista
    await prisma.intTemplate.upsert({
      where: { code: "file_people" },
      update: {},
      create: { code: "file_people", name: "Archivo: Personas", category: "file", targetModel: "people", isActive: true },
    });

    const intAlpha = await withTenantContext(tenantAlphaId, (tx) =>
      tx.intTenantIntegration.create({
        data: { tenantId: tenantAlphaId, integrationTemplateCode: "file_people", name: "Personas Alpha", config: {} },
      })
    );
    integrationAlphaId = intAlpha.id;

    const intBeta = await withTenantContext(tenantBetaId, (tx) =>
      tx.intTenantIntegration.create({
        data: { tenantId: tenantBetaId, integrationTemplateCode: "file_people", name: "Personas Beta", config: {} },
      })
    );
    integrationBetaId = intBeta.id;

    const run = await withTenantContext(tenantAlphaId, (tx) =>
      tx.intRun.create({
        data: {
          tenantId: tenantAlphaId,
          tenantIntegrationId: integrationAlphaId,
          status: "success",
          triggerSource: "manual",
          startedAt: new Date(),
          finishedAt: new Date(),
          rowsLoaded: 10,
        },
      })
    );
    runAlphaId = run.id;

    await withTenantContext(tenantAlphaId, (tx) =>
      tx.intRunError.create({
        data: {
          tenantId: tenantAlphaId,
          runId: runAlphaId,
          errorCode: "VALIDATION_ERROR",
          errorMessage: "Campo requerido vacío",
          severity: "error",
        },
      })
    );
  });

  afterAll(async () => {
    await withTenantContext(tenantAlphaId, (tx) =>
      tx.intRunError.deleteMany({ where: { tenantId: tenantAlphaId } })
    );
    await withTenantContext(tenantAlphaId, (tx) =>
      tx.intRun.deleteMany({ where: { tenantId: tenantAlphaId } })
    );
    await withTenantContext(tenantAlphaId, (tx) =>
      tx.intTenantIntegration.deleteMany({ where: { tenantId: tenantAlphaId } })
    );
    await withTenantContext(tenantBetaId, (tx) =>
      tx.intTenantIntegration.deleteMany({ where: { tenantId: tenantBetaId } })
    );
  });

  it("tenant Alpha solo ve sus propias integraciones", async () => {
    const integrations = await withTenantContext(tenantAlphaId, (tx) =>
      tx.intTenantIntegration.findMany()
    );
    expect(integrations).toHaveLength(1);
    expect(integrations[0]?.name).toBe("Personas Alpha");
  });

  it("contexto Alpha no puede leer integraciones de Beta", async () => {
    const integrations = await withTenantContext(tenantAlphaId, (tx) =>
      tx.intTenantIntegration.findMany({ where: { tenantId: tenantBetaId } })
    );
    expect(integrations).toHaveLength(0);
  });

  it("tenant Alpha solo ve sus propios runs", async () => {
    const runs = await withTenantContext(tenantAlphaId, (tx) =>
      tx.intRun.findMany()
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]?.rowsLoaded).toBe(10);
  });

  it("tenant Alpha solo ve sus propios errores de run", async () => {
    const errors = await withTenantContext(tenantAlphaId, (tx) =>
      tx.intRunError.findMany()
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.errorCode).toBe("VALIDATION_ERROR");
  });
});
