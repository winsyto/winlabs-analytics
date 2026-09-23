import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tables = [
  "hr_org_units",
  "hr_people",
  "hr_people_org_assignments",
  "hr_people_history",
  "cfg_absenteeism_types",
  "att_time_daily",
  "att_time_daily_entries",
  "att_absenteeism_events",
  "pay_periods",
  "pay_concepts",
  "pay_entries",
];

async function main() {
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS tenant_isolation ON "${t}"`);
    await prisma.$executeRawUnsafe(
      `CREATE POLICY tenant_isolation ON "${t}" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)`
    );
    console.log("RLS OK:", t);
  }
  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
