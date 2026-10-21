/**
 * Verifica la carga de Liquidaciones contra la base local, sin R2 ni job:
 * parser + carga por lotes sobre un tenant temporal, comparando con un cálculo independiente.
 * Casos: archivo de ejemplo (importes por concepto y por proceso, períodos y procesos creados, conceptos sin clasificar),
 * recarga idempotente, un concepto clasificado no se pisa, y el archivo con errores
 * (scripts/fixtures/file_payroll_errors.xlsx). Borra todo al terminar.
 * Uso (desde jobs/worker): npx tsx --env-file=.env scripts/verify-payroll-upload.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { parseFilePayroll } from "../src/handlers/filePayroll/parser";
import { upsertPayroll } from "../src/handlers/filePayroll/upsert";

const SLUG = "tmp-payroll-verify";
const EXAMPLE = path.resolve(__dirname, "../../../apps/cliente/public/examples/file_payroll.xlsx");
const ERRORS = path.resolve(__dirname, "fixtures/file_payroll_errors.xlsx");

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let tenantId = "";
  try {
    await cleanup(client);
    const t = await client.query<{ id: string }>(
      `INSERT INTO tenants (slug, name, updated_at) VALUES ($1, 'Tmp payroll verify', now()) RETURNING id`,
      [SLUG]
    );
    tenantId = t.rows[0]!.id;
    await client.query(`SELECT set_config('app.current_tenant_id', $1::text, false)`, [tenantId]);

    for (let n = 1; n <= 48; n++) {
      await client.query(
        `INSERT INTO hr_people (tenant_id, employee_code, full_name, hire_date, status, updated_at)
         VALUES ($1::uuid, $2, $3, '2020-01-01', 'active', now())`,
        [tenantId, `EMP${String(n).padStart(3, "0")}`, `Persona ${n}`]
      );
    }

    // ── 1. Archivo de ejemplo ────────────────────────────────────────────────
    const buf = await fs.readFile(EXAMPLE);
    const parsed = await parseFilePayroll(buf, "file_payroll.xlsx");
    check("ejemplo: sin errores de formato", parsed.errors.length === 0, `${parsed.rows.length} filas`);

    const expectedByConcept = new Map<string, number>();
    const expectedByProcess = new Map<string, number>();
    const keys = new Set<string>();
    const periods = new Set<string>();
    const processes = new Set<string>();
    for (const r of parsed.rows) {
      expectedByConcept.set(r.concept_code, (expectedByConcept.get(r.concept_code) ?? 0) + Number(r.amount));
      const pk = `${r.period_code}|${r.process_code}`;
      expectedByProcess.set(pk, (expectedByProcess.get(pk) ?? 0) + Number(r.amount));
      keys.add(`${r.employee_code}|${pk}|${r.concept_code}`);
      periods.add(r.period_code);
      processes.add(pk);
    }

    const t0 = Date.now();
    const res1 = await upsertPayroll(client, tenantId, 0, parsed.rows);
    check("ejemplo: todas las filas insertadas", res1.rows_inserted === parsed.rows.length && res1.rows_error === 0 && res1.rows_skipped === 0,
      `${res1.rows_inserted} insertadas en ${Date.now() - t0} ms`);
    check("ejemplo: períodos y procesos creados", res1.periods === periods.size && res1.processes === processes.size,
      `${res1.periods} períodos, ${res1.processes} procesos`);
    check("ejemplo: conceptos nuevos quedan sin clasificar",
      res1.concepts_created === expectedByConcept.size &&
        (await client.query(`SELECT 1 FROM pay_concepts WHERE tenant_id = $1::uuid AND (is_classified OR concept_type IS NOT NULL)`, [tenantId])).rowCount === 0,
      `${res1.concepts_created} conceptos`);
    check("ejemplo: avisa conceptos sin clasificar y totales sin marcar",
      res1.warnings.length === 2 && res1.warnings.some((w) => w.includes("sin clasificar")) && res1.warnings.some((w) => w.includes("bruto")),
      res1.warnings.join(" | "));

    const byConcept = await client.query<{ code: string; a: string }>(
      `SELECT c.code, SUM(e.amount)::text AS a FROM pay_entries e JOIN pay_concepts c ON c.id = e.concept_id
       WHERE e.tenant_id = $1::uuid GROUP BY c.code`,
      [tenantId]
    );
    check("ejemplo: importes por concepto coinciden con el archivo",
      byConcept.rows.length === expectedByConcept.size && byConcept.rows.every((r) => eq(Number(r.a), expectedByConcept.get(r.code) ?? NaN)));

    const byProcess = await client.query<{ pk: string; a: string }>(
      `SELECT pe.period_code || '|' || pr.code AS pk, SUM(e.amount)::text AS a
       FROM pay_entries e JOIN pay_processes pr ON pr.id = e.process_id JOIN pay_periods pe ON pe.id = pr.period_id
       WHERE e.tenant_id = $1::uuid GROUP BY 1`,
      [tenantId]
    );
    check("ejemplo: importes por proceso coinciden con el archivo",
      byProcess.rows.length === expectedByProcess.size && byProcess.rows.every((r) => eq(Number(r.a), expectedByProcess.get(r.pk) ?? NaN)));

    const count = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM pay_entries WHERE tenant_id = $1::uuid`, [tenantId]);
    check("ejemplo: cantidad de entradas = claves distintas del archivo", count.rows[0]!.n === keys.size, `${count.rows[0]!.n}`);

    const proc = await client.query<{ process_type: string; start_date: string; end_date: string; description: string }>(
      `SELECT process_type, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date, description
       FROM pay_processes WHERE tenant_id = $1::uuid AND code = 'SAC-2026-06'`,
      [tenantId]
    );
    check("ejemplo: el proceso de SAC conserva tipo, fechas y descripción",
      proc.rows[0]?.process_type === "sac" && proc.rows[0].start_date === "2026-06-01" && proc.rows[0].end_date === "2026-06-30" && !!proc.rows[0].description);

    const qty = await client.query<{ q: string }>(
      `SELECT SUM(e.quantity)::text AS q FROM pay_entries e JOIN pay_concepts c ON c.id = e.concept_id
       WHERE e.tenant_id = $1::uuid AND c.code = 'HHEE50'`,
      [tenantId]
    );
    const expectedQty = parsed.rows.filter((r) => r.concept_code === "HHEE50").reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    check("ejemplo: la cantidad (horas) se guarda", eq(Number(qty.rows[0]!.q), expectedQty), `${qty.rows[0]!.q} h`);

    // ── 2. Recarga idempotente y un concepto clasificado no se pisa ─────────
    await client.query(
      `UPDATE pay_concepts SET name = 'Básico renombrado', concept_type = 'salary', is_classified = true
       WHERE tenant_id = $1::uuid AND code = 'SUELDO_BASE'`,
      [tenantId]
    );
    const res2 = await upsertPayroll(client, tenantId, 0, parsed.rows);
    check("recarga: nada nuevo, todo actualizado", res2.rows_inserted === 0 && res2.rows_updated === parsed.rows.length && res2.concepts_created === 0,
      `${res2.rows_updated} actualizadas`);
    const after = await client.query<{ name: string; concept_type: string; is_classified: boolean }>(
      `SELECT name, concept_type, is_classified FROM pay_concepts WHERE tenant_id = $1::uuid AND code = 'SUELDO_BASE'`,
      [tenantId]
    );
    check("recarga: el concepto editado no se pisa",
      after.rows[0]?.name === "Básico renombrado" && after.rows[0].concept_type === "salary" && after.rows[0].is_classified);
    const count2 = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM pay_entries WHERE tenant_id = $1::uuid`, [tenantId]);
    check("recarga: no duplica entradas", count2.rows[0]!.n === keys.size);

    // ── 3. Archivo con errores ───────────────────────────────────────────────
    const errBuf = await fs.readFile(ERRORS);
    const errParsed = await parseFilePayroll(errBuf, "file_payroll_errors.xlsx");
    const errRows = new Set(errParsed.errors.map((e) => e.rowIndex));
    check("errores: 5 filas válidas y 7 con error", errParsed.rows.length === 5 && errRows.size === 7,
      `${errParsed.rows.length} válidas, filas con error: ${[...errRows].sort((a, b) => a - b).join(",")}`);
    const field = (row: number) => errParsed.errors.filter((e) => e.rowIndex === row).map((e) => e.field).join("+");
    check("errores: cada fila falla en el campo esperado",
      field(6) === "period_code" && field(7) === "process_type" && field(8) === "process_end" && field(9) === "amount" &&
        field(10) === "concept_code" && field(12) === "amount" && field(13) === "quantity",
      [6, 7, 8, 9, 10, 12, 13].map((r) => `${r}:${field(r)}`).join(" "));

    await client.query(`DELETE FROM pay_entries WHERE tenant_id = $1::uuid`, [tenantId]);
    const res3 = await upsertPayroll(client, tenantId, 0, errParsed.rows);
    check("errores: persona inexistente omitida y repetidas sumadas",
      res3.rows_inserted === 3 && res3.rows_skipped === 1 && res3.rows_error === 0, JSON.stringify({ i: res3.rows_inserted, s: res3.rows_skipped }));
    const summed = await client.query<{ amount: string; quantity: string }>(
      `SELECT e.amount::text, e.quantity::text FROM pay_entries e JOIN pay_concepts c ON c.id = e.concept_id
       JOIN hr_people p ON p.id = e.person_id
       WHERE e.tenant_id = $1::uuid AND c.code = 'HHEE50' AND p.employee_code = 'EMP002'`,
      [tenantId]
    );
    check("errores: las filas repetidas se suman (30000 + 15000, 10 + 5 h)",
      summed.rows.length === 1 && eq(Number(summed.rows[0]!.amount), 45000) && eq(Number(summed.rows[0]!.quantity), 15));
    check("errores: avisa persona inexistente, repetidas sumadas y concepto nuevo",
      res3.warnings.some((w) => w.includes("no existe")) && res3.warnings.some((w) => w.includes("se sumaron")) &&
        res3.warnings.some((w) => w.includes("CONCEPTO_NUEVO")),
      res3.warnings.map((w) => w.slice(0, 50)).join(" | "));
    const neg = await client.query<{ amount: string }>(
      `SELECT e.amount::text FROM pay_entries e JOIN pay_concepts c ON c.id = e.concept_id
       WHERE e.tenant_id = $1::uuid AND c.code = 'CONCEPTO_NUEVO'`,
      [tenantId]
    );
    check("errores: el importe negativo se guarda con su signo", neg.rows.length === 1 && eq(Number(neg.rows[0]!.amount), -2500.5));

    // ── 4. Un proceso con fechas distintas entre filas ──────────────────────
    const base = errParsed.rows[0]!;
    const res4 = await upsertPayroll(client, tenantId, 0, [
      { ...base, source_row: 2, process_code: "QUINC-1", process_type: "biweekly", process_start: "2026-09-01", process_end: "2026-09-15" },
      { ...base, source_row: 3, process_code: "QUINC-1", process_type: "biweekly", process_start: "2026-09-01", process_end: "2026-09-30", concept_code: "HHEE100", concept_name: "Horas extra 100%" },
    ]);
    const q = await client.query<{ end_date: string }>(
      `SELECT to_char(end_date,'YYYY-MM-DD') AS end_date FROM pay_processes WHERE tenant_id = $1::uuid AND code = 'QUINC-1'`,
      [tenantId]
    );
    check("proceso con fechas distintas: avisa y toma la primera fila",
      res4.warnings.some((w) => w.includes("QUINC-1")) && q.rows[0]?.end_date === "2026-09-15");
  } finally {
    await cleanup(client);
    client.release();
    await pool.end();
  }
  console.log(failed === 0 ? "\nTodo OK" : `\n${failed} verificación(es) fallaron`);
  process.exit(failed === 0 ? 0 : 1);
}

async function cleanup(client: pg.PoolClient) {
  const t = await client.query<{ id: string }>(`SELECT id FROM tenants WHERE slug = $1`, [SLUG]);
  const id = t.rows[0]?.id;
  if (!id) return;
  await client.query(`SELECT set_config('app.current_tenant_id', $1::text, false)`, [id]);
  for (const table of ["pay_entries", "pay_processes", "pay_periods", "pay_class_rules", "pay_concept_classes", "pay_concepts", "hr_people_history", "hr_people"]) {
    await client.query(`DELETE FROM ${table} WHERE tenant_id = $1::uuid`, [id]);
  }
  await client.query(`DELETE FROM tenants WHERE id = $1::uuid`, [id]);
  await client.query("RESET app.current_tenant_id").catch(() => undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
