/**
 * Seed de desarrollo — wlA
 *
 * Crea datos mínimos para poder probar el login en CMP y Cliente:
 *
 *   CMP (internal_users):
 *     winsyto.dev@gmail.com  /  admin123
 *
 *   Tenant 1: "acme" (Acme Corp)
 *     admin@acme.com    /  admin123    → rol admin
 *     analyst@acme.com  /  analyst123  → rol analyst
 *     viewer@acme.com   /  viewer123   → rol viewer
 *
 *   Tenant 2: "globo" (Globo Industries)
 *     admin@globo.com   /  admin123    → rol admin
 *     viewer@globo.com  /  viewer123   → rol viewer
 *
 * Idempotente: usa upsert en todo — se puede correr más de una vez sin errores.
 *
 * NOTA RLS: internal_users y tenants no tienen RLS.
 * roles, users y user_roles sí — se crean dentro de $transaction con set_config
 * para que las políticas los acepten.
 *
 * NOTA PERFORMANCE: los password hashes se calculan ANTES de abrir la transacción
 * para evitar que el bcrypt (lento por diseño) consuma el timeout de 5 s de Prisma.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function hash(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// ---------------------------------------------------------------------------
// Helper: ejecuta fn dentro de una transacción con el tenant context seteado.
// Timeout extendido a 30 s por si la latencia de red a Supabase es alta.
// ---------------------------------------------------------------------------
async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(tx);
    },
    { timeout: 30_000 }
  );
}

// ---------------------------------------------------------------------------
// Seed de un tenant completo: roles + usuarios + asignaciones
// Los passwordHash ya vienen pre-calculados para no bloquear la transacción.
// ---------------------------------------------------------------------------
interface TenantUser {
  email: string;
  passwordHash: string;
  name: string;
  role: "admin" | "analyst" | "viewer";
}

async function seedTenant(
  tenantId: string,
  tenantSlug: string,
  users: TenantUser[]
) {
  await withTenantContext(tenantId, async (tx) => {
    // 1. Roles
    const roleNames = ["admin", "analyst", "viewer"] as const;
    const roles: Record<string, { id: string }> = {};

    for (const name of roleNames) {
      const role = await tx.role.upsert({
        where: { tenantId_name: { tenantId, name } },
        update: {},
        create: {
          tenantId,
          name,
          description:
            name === "admin"
              ? "Acceso total al tenant"
              : name === "analyst"
                ? "Puede crear y editar reportes, lectura del resto"
                : "Solo lectura",
        },
      });
      roles[name] = role;
      console.log(`  ✅ Role [${tenantSlug}]: ${name}`);
    }

    // 2. Usuarios + asignación de rol
    for (const u of users) {
      const user = await tx.user.upsert({
        where: { tenantId_email: { tenantId, email: u.email } },
        update: {},
        create: {
          tenantId,
          email: u.email,
          passwordHash: u.passwordHash,
          name: u.name,
        },
      });

      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: roles[u.role].id } },
        update: {},
        create: {
          tenantId,
          userId: user.id,
          roleId: roles[u.role].id,
        },
      });

      console.log(`  ✅ User [${tenantSlug}]: ${user.email} → ${u.role}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 Iniciando seed...\n");

  // Pre-hashear todas las contraseñas ANTES de abrir cualquier transacción.
  // bcrypt es lento por diseño — hacerlo dentro de una tx la haría expirar.
  console.log("⏳ Hasheando contraseñas...");
  const [
    internalHash,
    adminHash,
    analystHash,
    viewerHash,
  ] = await Promise.all([
    hash("admin123"),
    hash("admin123"),
    hash("analyst123"),
    hash("viewer123"),
  ]);
  console.log("✅ Hashes listos\n");

  // 1. Internal user (CMP — sin RLS)
  const internalUser = await prisma.internalUser.upsert({
    where: { email: "winsyto.dev@gmail.com" },
    update: {},
    create: {
      email: "winsyto.dev@gmail.com",
      passwordHash: internalHash,
      name: "Winsyto",
    },
  });
  console.log(`✅ InternalUser: ${internalUser.email}\n`);

  // 2. Tenants (sin RLS)
  const acme = await prisma.tenant.upsert({
    where: { slug: "acme" },
    update: {},
    create: { slug: "acme", name: "Acme Corp" },
  });
  console.log(`✅ Tenant: ${acme.slug} (${acme.name})`);

  const globo = await prisma.tenant.upsert({
    where: { slug: "globo" },
    update: {},
    create: { slug: "globo", name: "Globo Industries" },
  });
  console.log(`✅ Tenant: ${globo.slug} (${globo.name})\n`);

  // 3. Roles + usuarios de acme (dentro de tenant context)
  await seedTenant(acme.id, "acme", [
    { email: "admin@acme.com",   passwordHash: adminHash,   name: "Admin Acme",   role: "admin" },
    { email: "analyst@acme.com", passwordHash: analystHash, name: "Analyst Acme", role: "analyst" },
    { email: "viewer@acme.com",  passwordHash: viewerHash,  name: "Viewer Acme",  role: "viewer" },
  ]);

  console.log();

  // 4. Roles + usuarios de globo
  await seedTenant(globo.id, "globo", [
    { email: "admin@globo.com",  passwordHash: adminHash,  name: "Admin Globo",  role: "admin" },
    { email: "viewer@globo.com", passwordHash: viewerHash, name: "Viewer Globo", role: "viewer" },
  ]);

  // Resumen
  console.log("\n🎉 Seed completado.\n");
  console.log("  CMP     → /login");
  console.log("            winsyto.dev@gmail.com  /  admin123\n");
  console.log("  Cliente → /login");
  console.log("    [acme]  admin@acme.com    /  admin123");
  console.log("            analyst@acme.com  /  analyst123");
  console.log("            viewer@acme.com   /  viewer123");
  console.log("    [globo] admin@globo.com   /  admin123");
  console.log("            viewer@globo.com  /  viewer123");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
