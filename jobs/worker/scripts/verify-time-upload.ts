/**
 * Verifica la carga de Asistencia (horas por tipo) contra la base local, sin R2 ni job:
 * parser + carga por lotes sobre un tenant temporal, comparando con un cálculo independiente.
 * Casos: archivo de ejemplo (totales por tipo y por día), recarga idempotente, reemplazo por día y tipo,
 * y el archivo con errores (scripts/fixtures/file_time_errors.xlsx). Borra todo al terminar.
 * Uso (desde jobs/worker): npx tsx --env-file=.env scripts/verify-time-upload.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { parseFileTimeAttendance } from "../src/handlers/fileTimeAttendance/parser";
import { upsertTimeAttendance } from "../src/handlers/fileTimeAttendance/upsert";

const SLUG = "tmp-time-verify";
const EXAMPLE = path.resolve(__dirname, "../../../apps/cliente/public/examples/file_time.xlsx");
const ERRORS = path.resolve(__dirname, "fixtures/file_time_errors.xlsx");

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
      `INSERT INTO tenants (slug, name, updated_at) VALUES ($1, 'Tmp time verify', now()) RETURNING id`,
      [SLUG]
    );
    tenantId = t.rows[0]!.id;
    await client.query(`SELECT set_config('app.current_tenant_id', $1::text, false)`, [tenantId]);

    // 48 personas (EMP001..EMP048) y los tipos de hora del catálogo base
    for (let n = 1; n <= 48; n++) {
      await client.query(
        `INSERT INTO hr_people (tenant_id, employee_code, full_name, hire_date, status, updated_at)
         VALUES ($1::uuid, $2, $3, '2020-01-01', 'active', now())`,
        [tenantId, `EMP${String(n).padStart(3, "0")}`, `Persona ${n}`]
      );
    }
    await client.query(
      `INSERT INTO cfg_tenant_time_entry_types (tenant_id, code, name, category, sign, is_classified, sort_order, updated_at)
       SELECT $1::uuid, code, name, category, sign, true, sort_order, now() FROM cfg_time_entry_types WHERE is_active`,
      [tenantId]
    );

    // ── 1. Archivo de ejemplo ────────────────────────────────────────────────
    const buf = await fs.readFile(EXAMPLE);
    const parsed = await parseFileTimeAttendance(buf, "file_time.xlsx");
    check("ejemplo: sin errores de formato", parsed.errors.length === 0, `${parsed.rows.length} filas`);

    const expectedByType = new Map<string, number>();
    const expectedDay = new Map<string, number>(); // persona|fecha -> horas que suman
    const sign: Record<string, number> = { ABSENT: 0, SICK_LEAVE: 0 };
    for (const r of parsed.rows) {
      expectedByType.set(r.time_entry_type, (expectedByType.get(r.time_entry_type) ?? 0) + Number(r.hours));
      const k = `${r.employee_code}|${r.date}`;
      expectedDay.set(k, (expectedDay.get(k) ?? 0) + (r.time_entry_type in sign ? 0 : Number(r.hours)));
    }

    const t0 = Date.now();
    const res1 = await upsertTimeAttendance(client, tenantId, 0, parsed.rows);
    check("ejemplo: todas las filas insertadas", res1.rows_inserted === parsed.rows.length && res1.rows_error === 0 && res1.rows_skipped === 0,
      `${res1.rows_inserted} insertadas en ${Date.now() - t0} ms`);
    check("ejemplo: sin avisos", res1.warnings.length === 0, res1.warnings.join(" | "));

    const byType = await client.query<{ code: string; h: string }>(
      `SELECT t.code, SUM(e.hours)::text AS h FROM att_time_daily_entries e
       JOIN cfg_tenant_time_entry_types t ON t.id = e.time_entry_type_id WHERE e.tenant_id = $1::uuid GROUP BY t.code`,
      [tenantId]
    );
    check("ejemplo: horas por tipo coinciden con el archivo",
      byType.rows.length === expectedByType.size && byType.rows.every((r) => eq(Number(r.h), expectedByType.get(r.code) ?? NaN)),
      byType.rows.map((r) => `${r.code}=${r.h}`).join(" "));

    const days = await client.query<{ emp: string; day: string; w: string; a: boolean }>(
      `SELECT p.employee_code AS emp, to_char(d.date, 'YYYY-MM-DD') AS day, d.worked_hours::text AS w, d.has_absence AS a
       FROM att_time_daily d JOIN hr_people p ON p.id = d.person_id WHERE d.tenant_id = $1::uuid`,
      [tenantId]
    );
    check("ejemplo: una cabecera por persona y día", days.rows.length === expectedDay.size, `${days.rows.length} días`);
    check("ejemplo: worked_hours de cada día coincide", days.rows.every((r) => eq(Number(r.w), expectedDay.get(`${r.emp}|${r.day}`) ?? NaN)));
    check("ejemplo: has_absence en falso (el ejemplo no trae ausencias)", days.rows.every((r) => !r.a));

    // ── 2. Recarga idempotente ───────────────────────────────────────────────
    const res2 = await upsertTimeAttendance(client, tenantId, 0, parsed.rows);
    const count = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM att_time_daily_entries WHERE tenant_id = $1::uuid`, [tenantId]);
    check("recarga: actualiza sin duplicar", res2.rows_updated === parsed.rows.length && res2.rows_inserted === 0 && Number(count.rows[0]!.n) === parsed.rows.length);

    // ── 3. Reemplazo por día y tipo: cambia OT50, no toca REGULAR ────────────
    const sample = parsed.rows.find((r) => r.time_entry_type === "OT50")!;
    const regular = parsed.rows.find((r) => r.employee_code === sample.employee_code && r.date === sample.date && r.time_entry_type !== "OT50")!;
    await upsertTimeAttendance(client, tenantId, 0, [{ ...sample, hours: "4" }]);
    const after = await client.query<{ code: string; hours: string; w: string }>(
      `SELECT t.code, e.hours::text, d.worked_hours::text AS w FROM att_time_daily_entries e
       JOIN cfg_tenant_time_entry_types t ON t.id = e.time_entry_type_id
       JOIN att_time_daily d ON d.id = e.time_daily_id
       JOIN hr_people p ON p.id = d.person_id
       WHERE e.tenant_id = $1::uuid AND p.employee_code = $2 AND d.date = $3::date`,
      [tenantId, sample.employee_code, sample.date]
    );
    const ot = after.rows.find((r) => r.code === "OT50");
    const reg = after.rows.find((r) => r.code === regular.time_entry_type);
    check("reemplazo: OT50 pasa a 4 horas y el otro tipo no cambia", eq(Number(ot?.hours), 4) && eq(Number(reg?.hours), Number(regular.hours)));
    const expectW = after.rows.reduce((s, r) => s + Number(r.hours), 0);
    check("reemplazo: worked_hours del día se recalcula", eq(Number(ot?.w), expectW), `${ot?.w} vs ${expectW}`);

    // ── 4. Archivo con errores ───────────────────────────────────────────────
    const errBuf = await fs.readFile(ERRORS);
    const perr = await parseFileTimeAttendance(errBuf, "file_time_errors.xlsx");
    const errFields = new Map(perr.errors.map((e) => [e.rowIndex, e.field]));
    check("errores: fila 6 fecha inválida", errFields.get(6) === "date");
    check("errores: fila 7 horas > 24", errFields.get(7) === "hours");
    check("errores: fila 8 horas negativas", errFields.get(8) === "hours");
    check("errores: fila 9 horas no numéricas", errFields.get(9) === "hours");
    check("errores: fila 10 tipo vacío", errFields.get(10) === "time_entry_type");
    check("errores: 5 filas con error, 8 válidas", perr.errors.length === 5 && perr.rows.length === 8, `${perr.errors.length} / ${perr.rows.length}`);

    const res3 = await upsertTimeAttendance(client, tenantId, 0, perr.rows);
    check("errores: persona inexistente omitida", res3.rows_skipped === 1 && res3.errors.some((e) => e.employee_code === "EMP999"));
    check("errores: tipo nuevo creado sin clasificar", res3.types_created === 1 && res3.warnings.some((w) => w.includes("HORA_GUARDIA")));
    check("errores: repetidas -> gana la última", res3.warnings.some((w) => w.includes("repetían")));
    check("errores: día con más de 24 horas avisado", res3.warnings.some((w) => w.includes("24 horas")));
    const guard = await client.query<{ category: string; is_classified: boolean }>(
      `SELECT category, is_classified FROM cfg_tenant_time_entry_types WHERE tenant_id = $1::uuid AND code = 'HORA_GUARDIA'`,
      [tenantId]
    );
    check("errores: HORA_GUARDIA queda como other / sin clasificar", guard.rows[0]?.category === "other" && guard.rows[0]?.is_classified === false);
    const win = await client.query<{ hours: string }>(
      `SELECT e.hours::text FROM att_time_daily_entries e JOIN att_time_daily d ON d.id = e.time_daily_id
       JOIN hr_people p ON p.id = d.person_id JOIN cfg_tenant_time_entry_types t ON t.id = e.time_entry_type_id
       WHERE e.tenant_id = $1::uuid AND p.employee_code = 'EMP002' AND d.date = '2026-09-21' AND t.code = 'OT50'`,
      [tenantId]
    );
    check("errores: OT50 repetida quedó en 3 (la última)", eq(Number(win.rows[0]?.hours), 3));
    const na = await client.query<{ hours: string }>(
      `SELECT e.hours::text FROM att_time_daily_entries e JOIN att_time_daily d ON d.id = e.time_daily_id
       JOIN hr_people p ON p.id = d.person_id
       JOIN cfg_tenant_time_entry_types t ON t.id = e.time_entry_type_id
       WHERE e.tenant_id = $1::uuid AND p.employee_code = 'EMP003' AND d.date = '2026-09-25' AND t.code = 'OT50NA'`,
      [tenantId]
    );
    check("errores: 1,5 con coma se lee como 1.5", eq(Number(na.rows[0]?.hours), 1.5));

    // ── 5. Formato viejo: falla con la lista de columnas ─────────────────────
    const old = Buffer.from("employee_code,date,is_working_day,scheduled_hours,worked_hours,has_absence\nEMP001,2026-09-01,1,8,8,0\n");
    const failedOld = await parseFileTimeAttendance(old, "viejo.csv").then(() => null, (e: Error) => e.message);
    check("formato viejo: falla nombrando las columnas que faltan", !!failedOld && failedOld.includes("time_entry_type") && failedOld.includes("hours"));
  } finally {
    await client.query("RESET app.current_tenant_id").catch(() => undefined);
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
  for (const table of ["att_time_daily_entries", "att_time_daily", "cfg_tenant_time_entry_types", "hr_people_history", "hr_people"]) {
    await client.query(`DELETE FROM ${table} WHERE tenant_id = $1::uuid`, [id]);
  }
  await client.query(`DELETE FROM tenants WHERE id = $1::uuid`, [id]);
  await client.query("RESET app.current_tenant_id").catch(() => undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
