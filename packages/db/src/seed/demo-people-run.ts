/**
 * Siembra solo los datos demo de People en el tenant "acme" (dev).
 * Uso: pnpm --filter @wla/db db:seed:demo-people
 */
import { PrismaClient } from "@prisma/client";
import { seedDemoPeople } from "./demo-people";
import { TERMINATION_REASONS } from "./termination-reasons";

const prisma = new PrismaClient();

async function main() {
  const acme = await prisma.tenant.findUnique({ where: { slug: "acme" } });
  if (!acme) throw new Error('Tenant "acme" no existe. Corré db:seed primero.');

  for (const t of TERMINATION_REASONS) {
    await prisma.cfgTerminationReason.upsert({
      where: { code: t.code },
      update: { name: t.name, category: t.category, isActive: true },
      create: { ...t, isActive: true },
    });
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${acme.id}, true)`;
      await seedDemoPeople(tx, acme.id);
    },
    { timeout: 60_000 }
  );
}

main()
  .catch((e) => {
    console.error("❌ Error en seed demo-people:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
