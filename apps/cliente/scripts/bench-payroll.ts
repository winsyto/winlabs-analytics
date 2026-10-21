/**
 * Medición de rendimiento del motor de Payroll: tenant temporal con 3.000 personas, 24 meses de liquidación y 12
 * conceptos por persona (~860 mil entradas). Mide con estadísticas viejas (recién cargado) y con ANALYZE. Uso
 * (desde apps/cliente):
 *   ../../packages/db/node_modules/.bin/tsx --env-file=.env.local scripts/bench-payroll.ts
 */
import { prisma, applyDefaultOrgConfig, applyDefaultPayrollClasses } from "@wla/db";
import { withTenantContext } from "@wla/auth";
import { loadDetail } from "../app/(dashboard)/payroll/_data/detail-queries";
import { loadPayroll } from "../app/(dashboard)/payroll/_data/queries";
import type { PayrollFilters } from "../app/(dashboard)/payroll/_data/filters";
import type { Dimension } from "../app/(dashboard)/_dashboard-kit/dimensions";

const PEOPLE = Number(process.env.BENCH_PEOPLE ?? 3000);
const MONTHS = 24;

const CONCEPTS: [string, string, string | null][] = [
  ["SUELDO", "salary", null], ["ANT", "additional", null], ["PRES", "additional", null], ["HE50", "salary", null],
  ["BONO", "salary", null], ["JUB", "employee_contribution", null], ["OS", "employee_contribution", null], ["PAMI", "employee_contribution", null],
  ["GAN", "income_tax", null], ["CONTRIB", "employer_contribution", null], ["BRUTO", "accumulators", "gross"], ["NETO", "accumulators", "net"],
];

async function main() {
  const slug = "tmp-pay-bench";
  await prisma.tenant.deleteMany({ where: { slug } }).catch(() => undefined);
  const tenant = await prisma.tenant.create({ data: { slug, name: "TMP bench payroll" } });
  const T = tenant.id;
  try {
    const areas: number[] = [];
    const locs: number[] = [];
    await withTenantContext(
      T,
      async (tx) => {
        await applyDefaultOrgConfig(tx, T);
        await applyDefaultPayrollClasses(tx, T);
        for (const [type, n, arr] of [["AREA", 20, areas], ["LOCATION", 8, locs]] as const) {
          for (let i = 1; i <= n; i++) {
            const u = await tx.hrOrgUnit.create({ data: { tenantId: T, orgUnitTypeCode: type, code: `${type}${i}`, name: `${type} ${i}`, isActive: true, level: 0 } });
            arr.push(u.id);
          }
        }
        for (const [code, type, ref] of CONCEPTS) {
          await tx.payConcept.create({ data: { tenantId: T, code, name: code, conceptType: type, referenceTotal: ref, isClassified: true } });
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO hr_people (tenant_id, employee_code, full_name, hire_date, status, updated_at)
           SELECT '${T}'::uuid, 'E' || g, 'Persona ' || g, '2020-01-01', 'active', now() FROM generate_series(1, ${PEOPLE}) g`
        );
        for (const [type, arr] of [["AREA", areas], ["LOCATION", locs]] as const) {
          await tx.$executeRawUnsafe(
            `INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, org_unit_type_code, valid_from)
             SELECT '${T}'::uuid, p.id, (ARRAY[${arr.join(",")}])[1 + (p.id % ${arr.length})], '${type}', '2020-01-01'
             FROM hr_people p WHERE p.tenant_id = '${T}'::uuid`
          );
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO pay_periods (tenant_id, period_code, start_date, end_date, updated_at)
           SELECT '${T}'::uuid, to_char(m, 'YYYY-MM'), m::date, (m + interval '1 month - 1 day')::date, now()
           FROM generate_series('2024-10-01'::date, '2026-09-01'::date, interval '1 month') m`
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO pay_processes (tenant_id, period_id, code, process_type, start_date, end_date, updated_at)
           SELECT '${T}'::uuid, id, 'MENS-' || period_code, 'monthly', start_date, end_date, now() FROM pay_periods WHERE tenant_id = '${T}'::uuid`
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO pay_entries (tenant_id, process_id, person_id, concept_id, amount)
           SELECT '${T}'::uuid, pr.id, p.id, c.id, ((p.id * 7 + c.id * 13 + pr.id) % 100000) + 1000
           FROM pay_processes pr CROSS JOIN hr_people p CROSS JOIN pay_concepts c
           WHERE pr.tenant_id = '${T}'::uuid AND p.tenant_id = '${T}'::uuid AND c.tenant_id = '${T}'::uuid`
        );
      },
      { timeout: 300_000 }
    );

    const [{ n }] = await withTenantContext(T, (tx) => tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM pay_entries`));
    console.log(`Cargado: ${PEOPLE} personas, ${MONTHS} meses, ${n} entradas`);

    if (process.env.BENCH_ONLYLOAD) return;
    const dims: Dimension[] = [
      { code: "AREA", name: "Área", slug: "area" },
      { code: "LOCATION", name: "Sucursal", slug: "location" },
    ];
    const time = async (label: string) => {
      for (const p of ["month", "12m", "year"] as const) {
        const filters: PayrollFilters = { p, dims: {} };
        const t0 = Date.now();
        const data = await loadPayroll(T, filters, dims);
        const t1 = Date.now();
        const dp = await loadDetail(T, filters, dims, "procesos", [], { page: 1, q: "" });
        const t2 = Date.now();
        const pe = await loadDetail(T, filters, dims, "personas", [], { page: 1, q: "" });
        const t3 = Date.now();
        console.log(
          `${label} ${p}: dashboard ${t1 - t0} ms · procesos ${t2 - t1} ms · personas ${t3 - t2} ms (${data.status}, ${dp.status}, ${pe.status})`
        );
      }
    };
    await time("estadísticas viejas");
    await withTenantContext(T, async (tx) => {
      for (const t of ["pay_entries", "pay_processes", "pay_periods", "hr_people", "hr_people_org_assignments"]) await tx.$executeRawUnsafe(`ANALYZE ${t}`);
    });
    await time("con ANALYZE        ");
  } finally {
    if (process.env.BENCH_KEEP) {
      console.log("BENCH_KEEP: tenant conservado:", T);
      await prisma.$disconnect();
      return;
    }
    await withTenantContext(
      T,
      async (tx) => {
        for (const t of ["pay_entries", "pay_processes", "pay_periods", "pay_class_rules", "pay_concept_classes", "pay_concepts", "hr_people_org_assignments", "hr_people", "hr_org_units", "dsh_dimensions", "cfg_tenant_org_unit_types", "cfg_tenant_settings"]) {
          await tx.$executeRawUnsafe(`DELETE FROM ${t} WHERE tenant_id = '${T}'::uuid`);
        }
      },
      { timeout: 300_000 }
    );
    await prisma.tenant.delete({ where: { id: T } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
