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
