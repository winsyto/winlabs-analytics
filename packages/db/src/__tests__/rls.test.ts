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

describe("RLS — configuración de unidades organizativas y asignaciones con vigencia", () => {
  let alphaPersonId: number;
  let betaPersonId: number;
  let alphaAreaId: number;
  let alphaArea2Id: number;
  let betaAreaId: number;

  beforeAll(async () => {
    await seedOrgUnitType("AREA", "Área");
    await seedOrgUnitType("POSITION", "Puesto");

    for (const tenantId of [tenantAlphaId, tenantBetaId]) {
      await withTenantContext(tenantId, async (tx) => {
        await tx.cfgTenantOrgUnitType.upsert({
          where: { uq_cfg_tenant_org_unit_types: { tenantId, orgUnitTypeCode: "AREA" } },
          update: {},
          create: { tenantId, orgUnitTypeCode: "AREA", isEnabled: true, sortOrder: 1 },
        });
        await tx.dshDimension.upsert({
          where: { uq_dsh_dimensions: { tenantId, dashboardCode: "headcount", orgUnitTypeCode: "AREA" } },
          update: {},
          create: { tenantId, dashboardCode: "headcount", orgUnitTypeCode: "AREA", sortOrder: 1 },
        });
      });
    }

    alphaAreaId = (await createTestOrgUnit(tenantAlphaId, "AREA", "OPS", "Operaciones Alpha")).id;
    alphaArea2Id = (await createTestOrgUnit(tenantAlphaId, "AREA", "FIN", "Finanzas Alpha")).id;
    betaAreaId = (await createTestOrgUnit(tenantBetaId, "AREA", "OPS", "Operaciones Beta")).id;
    alphaPersonId = (await createTestPerson(tenantAlphaId, "EMP-A-VIG", "Alice Vigencia")).id;
    betaPersonId = (await createTestPerson(tenantBetaId, "EMP-B-VIG", "Charlie Vigencia")).id;

    await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrPeopleOrgAssignment.create({
        data: {
          tenantId: tenantAlphaId,
          personId: alphaPersonId,
          orgUnitId: alphaAreaId,
          orgUnitTypeCode: "AREA",
          validFrom: new Date("2024-01-01"),
        },
      })
    );
    await withTenantContext(tenantBetaId, (tx) =>
      tx.hrPeopleOrgAssignment.create({
        data: {
          tenantId: tenantBetaId,
          personId: betaPersonId,
          orgUnitId: betaAreaId,
          orgUnitTypeCode: "AREA",
          validFrom: new Date("2024-01-01"),
        },
      })
    );
  });

  afterAll(async () => {
    for (const tenantId of [tenantAlphaId, tenantBetaId]) {
      await withTenantContext(tenantId, async (tx) => {
        await tx.hrPeopleOrgAssignment.deleteMany({ where: { tenantId } });
        await tx.hrPerson.deleteMany({ where: { tenantId } });
        await tx.hrOrgUnit.deleteMany({ where: { tenantId } });
        await tx.dshDimension.deleteMany({ where: { tenantId } });
        await tx.cfgTenantOrgUnitType.deleteMany({ where: { tenantId } });
      });
    }
  });

  it("cada tenant ve solo su configuración de tipos y dimensiones", async () => {
    const types = await withTenantContext(tenantAlphaId, (tx) => tx.cfgTenantOrgUnitType.findMany());
    const dims = await withTenantContext(tenantAlphaId, (tx) => tx.dshDimension.findMany());
    expect(types.every((t) => t.tenantId === tenantAlphaId)).toBe(true);
    expect(dims.every((d) => d.tenantId === tenantAlphaId)).toBe(true);

    const betaTypes = await withTenantContext(tenantAlphaId, (tx) =>
      tx.cfgTenantOrgUnitType.findMany({ where: { tenantId: tenantBetaId } })
    );
    expect(betaTypes).toHaveLength(0);
  });

  it("cada tenant ve solo sus asignaciones", async () => {
    const rows = await withTenantContext(tenantAlphaId, (tx) => tx.hrPeopleOrgAssignment.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.personId).toBe(alphaPersonId);
  });

  it("no permite dos asignaciones del mismo tipo que se solapen para una persona", async () => {
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.hrPeopleOrgAssignment.create({
          data: {
            tenantId: tenantAlphaId,
            personId: alphaPersonId,
            orgUnitId: alphaArea2Id,
            orgUnitTypeCode: "AREA",
            validFrom: new Date("2024-06-01"),
          },
        })
      )
    ).rejects.toThrow();
  });

  it("permite un cambio de unidad encadenado sin solapamiento", async () => {
    await withTenantContext(tenantAlphaId, async (tx) => {
      await tx.hrPeopleOrgAssignment.updateMany({
        where: { tenantId: tenantAlphaId, personId: alphaPersonId, validTo: null },
        data: { validTo: new Date("2024-05-31") },
      });
      await tx.hrPeopleOrgAssignment.create({
        data: {
          tenantId: tenantAlphaId,
          personId: alphaPersonId,
          orgUnitId: alphaArea2Id,
          orgUnitTypeCode: "AREA",
          validFrom: new Date("2024-06-01"),
        },
      });
    });
    const rows = await withTenantContext(tenantAlphaId, (tx) => tx.hrPeopleOrgAssignment.findMany());
    expect(rows).toHaveLength(2);
  });

  it("rechaza vigencias invertidas y tipo incoherente con la unidad", async () => {
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.hrPeopleOrgAssignment.create({
          data: {
            tenantId: tenantAlphaId,
            personId: alphaPersonId,
            orgUnitId: alphaAreaId,
            orgUnitTypeCode: "POSITION",
            validFrom: new Date("2020-01-01"),
          },
        })
      )
    ).rejects.toThrow();
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.hrPeopleOrgAssignment.create({
          data: {
            tenantId: tenantAlphaId,
            personId: alphaPersonId,
            orgUnitId: alphaAreaId,
            orgUnitTypeCode: "AREA",
            validFrom: new Date("2000-02-01"),
            validTo: new Date("2000-01-01"),
          },
        })
      )
    ).rejects.toThrow();
  });
});

describe("RLS — horarios de turnos (hr_shift_schedules)", () => {
  let alphaShiftId: number;
  let alphaAreaId: number;
  let betaShiftId: number;

  beforeAll(async () => {
    await seedOrgUnitType("SHIFT", "Turno");
    await seedOrgUnitType("AREA", "Área");
    alphaShiftId = (await createTestOrgUnit(tenantAlphaId, "SHIFT", "MAN", "Mañana Alpha")).id;
    alphaAreaId = (await createTestOrgUnit(tenantAlphaId, "AREA", "SCHED", "Área horarios Alpha")).id;
    betaShiftId = (await createTestOrgUnit(tenantBetaId, "SHIFT", "MAN", "Mañana Beta")).id;
    await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrShiftSchedule.create({
        data: { tenantId: tenantAlphaId, orgUnitId: alphaShiftId, dailyHours: 8, workWeek: "1111100" },
      })
    );
    await withTenantContext(tenantBetaId, (tx) =>
      tx.hrShiftSchedule.create({
        data: { tenantId: tenantBetaId, orgUnitId: betaShiftId, dailyHours: 6, workWeek: "1111110" },
      })
    );
  });

  afterAll(async () => {
    for (const tenantId of [tenantAlphaId, tenantBetaId]) {
      await withTenantContext(tenantId, async (tx) => {
        await tx.hrShiftSchedule.deleteMany({ where: { tenantId } });
        await tx.hrOrgUnit.deleteMany({ where: { tenantId } });
      });
    }
  });

  it("cada tenant ve solo los horarios de sus turnos", async () => {
    const rows = await withTenantContext(tenantAlphaId, (tx) => tx.hrShiftSchedule.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.orgUnitId).toBe(alphaShiftId);
    const cross = await withTenantContext(tenantAlphaId, (tx) =>
      tx.hrShiftSchedule.findMany({ where: { tenantId: tenantBetaId } })
    );
    expect(cross).toHaveLength(0);
  });

  it("un tenant no puede crear un horario para la unidad de otro", async () => {
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.hrShiftSchedule.create({
          data: { tenantId: tenantBetaId, orgUnitId: betaShiftId, dailyHours: 8, workWeek: "1111100" },
        })
      )
    ).rejects.toThrow();
  });

  it("rechaza semanas laborales mal formadas, horas inválidas y unidades que no son turno", async () => {
    for (const workWeek of ["111110", "1111102", "abcdefg"]) {
      await expect(
        withTenantContext(tenantAlphaId, (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE hr_shift_schedules SET work_week = '${workWeek}' WHERE org_unit_id = ${alphaShiftId}`
          )
        )
      ).rejects.toThrow();
    }
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.$executeRawUnsafe(`UPDATE hr_shift_schedules SET daily_hours = 25 WHERE org_unit_id = ${alphaShiftId}`)
      )
    ).rejects.toThrow();
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.hrShiftSchedule.create({
          data: { tenantId: tenantAlphaId, orgUnitId: alphaAreaId, dailyHours: 8, workWeek: "1111100" },
        })
      )
    ).rejects.toThrow();
  });

  it("no permite dos horarios para la misma unidad", async () => {
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.hrShiftSchedule.create({
          data: { tenantId: tenantAlphaId, orgUnitId: alphaShiftId, dailyHours: 7, workWeek: "1111100" },
        })
      )
    ).rejects.toThrow();
  });
});

describe("RLS — ajustes y metas por tenant", () => {
  beforeAll(async () => {
    for (const tenantId of [tenantAlphaId, tenantBetaId]) {
      await withTenantContext(tenantId, async (tx) => {
        await tx.cfgTenantSetting.upsert({ where: { tenantId }, update: {}, create: { tenantId } });
        await tx.cfgTenantMetricTarget.upsert({
          where: { uq_cfg_tenant_metric_targets: { tenantId, metricCode: "absenteeism_rate" } },
          update: {},
          create: { tenantId, metricCode: "absenteeism_rate", targetValue: 4, unit: "percent_monthly" },
        });
      });
    }
  });

  afterAll(async () => {
    for (const tenantId of [tenantAlphaId, tenantBetaId]) {
      await withTenantContext(tenantId, async (tx) => {
        await tx.cfgTenantSetting.deleteMany({ where: { tenantId } });
        await tx.cfgTenantMetricTarget.deleteMany({ where: { tenantId } });
      });
    }
  });

  it("cada tenant ve solo sus ajustes y metas", async () => {
    const settings = await withTenantContext(tenantAlphaId, (tx) => tx.cfgTenantSetting.findMany());
    const targets = await withTenantContext(tenantAlphaId, (tx) => tx.cfgTenantMetricTarget.findMany());
    expect(settings).toHaveLength(1);
    expect(settings[0]?.tenantId).toBe(tenantAlphaId);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.tenantId).toBe(tenantAlphaId);
  });

  it("un tenant no puede escribir ajustes ni metas de otro", async () => {
    await expect(
      withTenantContext(tenantAlphaId, (tx) =>
        tx.cfgTenantMetricTarget.create({
          data: { tenantId: tenantBetaId, metricCode: "turnover_rate", targetValue: 18, unit: "percent_annual" },
        })
      )
    ).rejects.toThrow();
    const updated = await withTenantContext(tenantAlphaId, (tx) =>
      tx.cfgTenantSetting.updateMany({ where: { tenantId: tenantBetaId }, data: { absenceDisplay: "hours" } })
    );
    expect(updated.count).toBe(0);
  });

  it("rechaza valores fuera de rango o desconocidos", async () => {
    const run = (sql: string) => withTenantContext(tenantAlphaId, (tx) => tx.$executeRawUnsafe(sql));
    await expect(run("UPDATE cfg_tenant_settings SET attendance_mode = 'otro'")).rejects.toThrow();
    await expect(run("UPDATE cfg_tenant_settings SET default_work_week = '11111'")).rejects.toThrow();
    await expect(run("UPDATE cfg_tenant_settings SET default_daily_hours = 0")).rejects.toThrow();
    await expect(run("UPDATE cfg_tenant_settings SET absence_display = 'x'")).rejects.toThrow();
    await expect(run("UPDATE cfg_tenant_metric_targets SET target_value = 101")).rejects.toThrow();
    await expect(run("UPDATE cfg_tenant_metric_targets SET metric_code = 'inventada'")).rejects.toThrow();
  });

  it("las dimensiones admiten el dashboard de ausentismos por tenant", async () => {
    await seedOrgUnitType("AREA", "Área");
    await withTenantContext(tenantAlphaId, (tx) =>
      tx.dshDimension.create({ data: { tenantId: tenantAlphaId, dashboardCode: "absenteeism", orgUnitTypeCode: "AREA", sortOrder: 1 } })
    );
    const betaRows = await withTenantContext(tenantBetaId, (tx) =>
      tx.dshDimension.findMany({ where: { dashboardCode: "absenteeism" } })
    );
    expect(betaRows).toHaveLength(0);
    await withTenantContext(tenantAlphaId, (tx) => tx.dshDimension.deleteMany({ where: { dashboardCode: "absenteeism" } }));
  });
});
