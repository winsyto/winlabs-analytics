/**
 * Verificación del motor de Payroll contra una implementación independiente que parte de las entradas del archivo
 * (no de las consultas). Crea un tenant temporal con casos de borde, compara y lo borra. Uso (desde apps/cliente):
 *   ../../packages/db/node_modules/.bin/tsx --env-file=.env.local scripts/verify-payroll-engine.ts
 *
 * Casos: dos procesos en el mismo mes (mensual + SAC), un mes sin liquidación (sin datos), persona que cambia de
 * área (cuenta en la unidad vigente al fin del mes liquidado), concepto sin clasificar, concepto que no entra
 * (contribuciones patronales), concepto de clase por regla de concepto (gana sobre el tipo), unidades con menos de
 * 3 personas (reservadas), filtros que dejan menos de 3 personas (restringido), y con o sin acumuladores de
 * bruto y neto marcados (la masa bruta sale de las clases de haber).
 */
import { prisma, applyDefaultOrgConfig, applyDefaultPayrollClasses } from "@wla/db";
import { withTenantContext } from "@wla/auth";
import { loadDetail } from "../app/(dashboard)/payroll/_data/detail-queries";
import { loadPayroll } from "../app/(dashboard)/payroll/_data/queries";
import type { PayrollFilters } from "../app/(dashboard)/payroll/_data/filters";
import { addMonths, buildPeriod, monthEnd } from "../app/(dashboard)/_dashboard-kit/period";
import type { Dimension } from "../app/(dashboard)/_dashboard-kit/dimensions";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

// ── Fixtures (el cálculo independiente lee SOLO esto, no la base) ───────────────────────────────────────────
interface Assign { type: "AREA" | "LOCATION"; unit: string; from: string; to: string | null }
interface Person { code: string; hire: string; term: string | null; assigns: Assign[] }
const A = (type: Assign["type"], unit: string, from: string, to: string | null = null): Assign => ({ type, unit, from, to });

const people: Person[] = [
  { code: "P0", hire: "2024-01-01", term: null, assigns: [A("AREA", "X", "2024-01-01"), A("LOCATION", "N", "2024-01-01")] },
  { code: "P1", hire: "2024-01-01", term: null, assigns: [A("AREA", "X", "2024-01-01"), A("LOCATION", "N", "2024-01-01")] },
  { code: "P2", hire: "2024-01-01", term: null, assigns: [A("AREA", "X", "2024-01-01"), A("LOCATION", "S", "2024-01-01")] },
  { code: "P3", hire: "2024-01-01", term: null, assigns: [A("AREA", "X", "2024-01-01"), A("LOCATION", "S", "2024-01-01")] },
  { code: "P4", hire: "2024-01-01", term: null, assigns: [A("AREA", "X", "2024-01-01", "2026-04-14"), A("AREA", "Y", "2026-04-15"), A("LOCATION", "N", "2024-01-01")] },
  { code: "P5", hire: "2024-01-01", term: null, assigns: [A("AREA", "Y", "2024-01-01"), A("LOCATION", "S", "2024-01-01")] },
  { code: "P6", hire: "2024-01-01", term: null, assigns: [A("AREA", "Y", "2024-01-01"), A("LOCATION", "S", "2024-01-01")] },
  { code: "P7", hire: "2025-10-10", term: null, assigns: [A("AREA", "Y", "2025-10-10"), A("LOCATION", "N", "2025-10-10")] },
  { code: "P8", hire: "2024-01-01", term: "2026-05-20", assigns: [A("AREA", "X", "2024-01-01"), A("LOCATION", "N", "2024-01-01")] },
  { code: "P9", hire: "2024-01-01", term: null, assigns: [A("LOCATION", "N", "2024-01-01")] },
  { code: "P10", hire: "2024-01-01", term: null, assigns: [A("LOCATION", "S", "2024-01-01")] },
  { code: "P11", hire: "2026-01-05", term: null, assigns: [A("AREA", "X", "2026-01-05"), A("LOCATION", "N", "2026-01-05")] },
];

/** Meses liquidados: agosto 2025 a septiembre 2026, salvo marzo 2026 (sin liquidación) */
const ALL_MONTHS: string[] = [];
for (let m = "2025-08-01"; m <= "2026-09-01"; m = addMonths(m, 1)) ALL_MONTHS.push(m);
const COVERED = new Set(ALL_MONTHS.filter((m) => m !== "2026-03-01"));
const REF = "2026-09-01";
const FIRST = "2025-08-01";

interface Entry { person: string; month: string; process: string; type: string; ptype: string; concept: string; amount: number; qty: number | null }
interface ConceptDef { code: string; name: string; type: string | null; ref?: "gross" | "net"; classified: boolean; cls: string | null; ruleClass?: string }
const CONCEPTS: ConceptDef[] = [
  { code: "SUELDO", name: "Sueldo", type: "salary", classified: true, cls: "sueldo" },
  { code: "SAC", name: "SAC", type: "sac", classified: true, cls: "sueldo" },
  { code: "ANT", name: "Antigüedad", type: "additional", classified: true, cls: "otros_haberes" },
  { code: "HE50", name: "Horas extra 50%", type: "salary", classified: true, cls: "horas_extra", ruleClass: "horas_extra" },
  { code: "BONO", name: "Bono", type: "salary", classified: true, cls: "bonos", ruleClass: "bonos" },
  { code: "JUB", name: "Jubilación", type: "employee_contribution", classified: true, cls: "impuestos" },
  { code: "GAN", name: "Ganancias", type: "income_tax", classified: true, cls: "impuestos" },
  { code: "PREST", name: "Préstamo", type: "loans", classified: true, cls: "otras_retenciones" },
  { code: "CONTRIB", name: "Contribuciones patronales", type: "employer_contribution", classified: true, cls: null },
  { code: "BRUTO", name: "Total bruto", type: "accumulators", ref: "gross", classified: true, cls: null },
  { code: "NETO", name: "Total neto", type: "accumulators", ref: "net", classified: true, cls: null },
  { code: "NUEVO", name: "Concepto nuevo", type: null, classified: false, cls: "uncl" },
];
const CLASS_SIDE: Record<string, "earning" | "deduction"> = {
  sueldo: "earning", horas_extra: "earning", bonos: "earning", otros_haberes: "earning", impuestos: "deduction", otras_retenciones: "deduction",
};

const entries: Entry[] = [];
{
  let mi = -1;
  for (const m of ALL_MONTHS) {
    mi++;
    if (!COVERED.has(m)) continue;
    const end = monthEnd(m);
    const calMonth = Number(m.slice(5, 7));
    people.forEach((p, i) => {
      if (p.hire > end || (p.term && p.term < m)) return;
      const base = 100000 + 10000 * i + 1000 * mi;
      const mon = `MENS-${m.slice(0, 7)}`;
      const add = (concept: string, amount: number, qty: number | null = null, process = mon, ptype = "monthly") =>
        entries.push({ person: p.code, month: m, process, type: ptype, ptype, concept, amount, qty });
      const parts: number[] = [base];
      add("SUELDO", base);
      if (i % 2 === 0) { const a = Math.round(base * 0.01); add("ANT", a); parts.push(a); }
      if ((i + mi) % 3 === 0) { const h = 5000 + 100 * mi; add("HE50", h, 10); parts.push(h); }
      if (mi % 4 === 3 && i % 2 === 0) { const b = Math.round(base / 2); add("BONO", b); parts.push(b); }
      const gross = parts.reduce((s, x) => s + x, 0);
      const jub = -Math.round(gross * 0.11);
      const gan = i % 5 === 0 ? -2000 : 0;
      const pre = i % 4 === 1 ? -3000 : 0;
      add("JUB", jub);
      if (gan) add("GAN", gan);
      if (pre) add("PREST", pre);
      add("CONTRIB", Math.round(gross * 0.24));
      add("BRUTO", gross);
      add("NETO", gross + jub + gan + pre);
      if (i === 3 && mi >= 10) add("NUEVO", 777);
      if (calMonth === 12 || calMonth === 6) {
        const sac = Math.round(base / 2);
        const proc = `SAC-${m.slice(0, 7)}`;
        add("SAC", sac, null, proc, "sac");
        add("BRUTO", sac, null, proc, "sac");
        add("NETO", Math.round(sac * 0.89), null, proc, "sac");
      }
      // Ajuste de febrero 2026 a dos personas: el proceso queda con menos de 3 personas (reservado)
      if (m === "2026-02-01" && (i === 0 || i === 1)) {
        add("SUELDO", 1500, null, "AJUS-2026-02", "adjustments");
        add("BRUTO", 1500, null, "AJUS-2026-02", "adjustments");
        add("NETO", 1300, null, "AJUS-2026-02", "adjustments");
      }
    });
  }
}

// ── Cálculo independiente ───────────────────────────────────────────────────────────────────────────────────
const unitAt = (p: Person, type: string, day: string): string | null =>
  p.assigns.find((a) => a.type === type && a.from <= day && (a.to === null || a.to >= day))?.unit ?? null;
interface DimSel { ids: string[]; none: boolean }
interface Q { area?: DimSel; location?: DimSel }
const pass = (sel: DimSel | undefined, unit: string | null) => !sel || (unit === null ? sel.none : sel.ids.includes(unit));
const passUnits = (q: Q, p: Person, day: string) => pass(q.area, unitAt(p, "AREA", day)) && pass(q.location, unitAt(p, "LOCATION", day));
const byCode = new Map(people.map((p) => [p.code, p]));
const conceptDef = new Map(CONCEPTS.map((c) => [c.code, c]));

/** Clase efectiva de un concepto (null = no entra). Con refs marcados, bruto/neto son claves aparte. */
const keyOf = (concept: string, withRefs: boolean): string | null => {
  const c = conceptDef.get(concept)!;
  if (c.ref) return withRefs ? c.ref : null;
  return c.cls;
};

const monthsOf = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) if (COVERED.has(m)) out.push(m);
  return out;
};

interface Cell { amt: Map<string, number>; persons: Set<string>; earn: number }
/** Importes por mes para el filtro q: por clave y personas con masa bruta */
function brute(months: string[], q: Q, withRefs: boolean, groupBy?: { type: "AREA" | "LOCATION" }) {
  const out = new Map<string, Map<string, { gross: number; pm: number; persons: Set<string> }>>();
  const monthly = new Map<string, Cell>();
  for (const m of months) {
    const cell: Cell = { amt: new Map(), persons: new Set(), earn: 0 };
    monthly.set(m, cell);
    const perPerson = new Map<string, { gross: number; has: boolean }>();
    for (const e of entries) {
      if (e.month !== m) continue;
      const p = byCode.get(e.person)!;
      if (!passUnits(q, p, monthEnd(m))) continue;
      const k = keyOf(e.concept, withRefs);
      if (!k) continue;
      cell.amt.set(k, (cell.amt.get(k) ?? 0) + e.amount);
      const isEarn = k in CLASS_SIDE && CLASS_SIDE[k] === "earning";
      if (isEarn) cell.earn += e.amount;
      const basis = withRefs ? k === "gross" : isEarn;
      if (basis) {
        cell.persons.add(e.person);
        const pp = perPerson.get(e.person) ?? { gross: 0, has: false };
        pp.gross += e.amount;
        pp.has = true;
        perPerson.set(e.person, pp);
      }
    }
    if (groupBy) {
      for (const [code, pp] of perPerson) {
        const unit = unitAt(byCode.get(code)!, groupBy.type, monthEnd(m)) ?? "none";
        const g = out.get(unit) ?? new Map();
        const row = g.get("all") ?? { gross: 0, pm: 0, persons: new Set<string>() };
        row.gross += pp.gross;
        row.pm += 1;
        row.persons.add(code);
        g.set("all", row);
        out.set(unit, g);
      }
    }
  }
  return { monthly, units: out };
}

const near = (a: number | null | undefined, b: number | null, label: string, fails: string[]) => {
  if (a === null || a === undefined || b === null) {
    if (!(a === null || a === undefined) || b !== null) fails.push(`${label}: motor ${a} vs independiente ${b}`);
    return;
  }
  if (Math.abs(a - b) > 1e-6) fails.push(`${label}: motor ${a} vs independiente ${b}`);
};

const sumM = (monthly: Map<string, Cell>, months: string[], f: (c: Cell) => number) => months.reduce((s, m) => s + f(monthly.get(m)!), 0);

async function main() {
  const slug = "tmp-pay-verify";
  await prisma.tenant.deleteMany({ where: { slug } }).catch(() => undefined);
  const tenant = await prisma.tenant.create({ data: { slug, name: "TMP verify payroll" } });
  const tenantId = tenant.id;
  const ids = new Map<string, number>();
  try {
    await withTenantContext(
      tenantId,
      async (tx) => {
        await applyDefaultOrgConfig(tx, tenantId);
        await applyDefaultPayrollClasses(tx, tenantId);
        await tx.cfgTenantSetting.upsert({ where: { tenantId }, update: { currency: "ARS" }, create: { tenantId } });
        for (const [type, code, name] of [["AREA", "X", "Área X"], ["AREA", "Y", "Área Y"], ["LOCATION", "N", "Norte"], ["LOCATION", "S", "Sur"]] as const) {
          const u = await tx.hrOrgUnit.create({ data: { tenantId, orgUnitTypeCode: type, code, name, isActive: true, level: 0 } });
          ids.set(`${type}:${code}`, u.id);
        }
        const personIds = new Map<string, number>();
        for (const p of people) {
          const row = await tx.hrPerson.create({
            data: { tenantId, employeeCode: p.code, fullName: p.code, hireDate: d(p.hire), terminationDate: p.term ? d(p.term) : null, status: p.term ? "inactive" : "active" },
          });
          personIds.set(p.code, row.id);
          for (const a of p.assigns) {
            await tx.hrPeopleOrgAssignment.create({
              data: { tenantId, personId: row.id, orgUnitId: ids.get(`${a.type}:${a.unit}`)!, orgUnitTypeCode: a.type, validFrom: d(a.from), validTo: a.to ? d(a.to) : null },
            });
          }
        }
        const classId = new Map((await tx.payConceptClass.findMany({ where: { tenantId } })).map((c) => [c.code, c.id]));
        const conceptIds = new Map<string, number>();
        for (const c of CONCEPTS) {
          const row = await tx.payConcept.create({
            data: { tenantId, code: c.code, name: c.name, conceptType: c.type, referenceTotal: c.ref ?? null, isClassified: c.classified },
          });
          conceptIds.set(c.code, row.id);
          if (c.ruleClass) await tx.payClassRule.create({ data: { tenantId, classId: classId.get(c.ruleClass)!, conceptId: row.id } });
        }
        const periods = new Map<string, number>();
        const procs = new Map<string, number>();
        for (const e of entries) {
          const code = e.month.slice(0, 7);
          if (!periods.has(code)) {
            const pe = await tx.payPeriod.create({ data: { tenantId, periodCode: code, startDate: d(e.month), endDate: d(monthEnd(e.month)) } });
            periods.set(code, pe.id);
          }
          const pk = `${code}|${e.process}`;
          if (!procs.has(pk)) {
            const pr = await tx.payProcess.create({
              data: { tenantId, periodId: periods.get(code)!, code: e.process, processType: e.ptype, startDate: d(e.month), endDate: d(monthEnd(e.month)) },
            });
            procs.set(pk, pr.id);
          }
        }
        await tx.payEntry.createMany({
          data: entries.map((e) => ({
            tenantId,
            processId: procs.get(`${e.month.slice(0, 7)}|${e.process}`)!,
            personId: personIds.get(e.person)!,
            conceptId: conceptIds.get(e.concept)!,
            amount: e.amount,
            quantity: e.qty,
          })),
        });
      },
      { timeout: 120_000 }
    );

    const dims: Dimension[] = [
      { code: "AREA", name: "Área", slug: "area" },
      { code: "LOCATION", name: "Sucursal", slug: "location" },
    ];
    const uid = (type: string, c: string) => ids.get(`${type}:${c}`)!;
    const none = { ids: [] as number[], none: true };

    const cases: { name: string; p: PayrollFilters["p"]; dimsF: PayrollFilters["dims"]; q: Q }[] = [
      { name: "mes", p: "month", dimsF: {}, q: {} },
      { name: "12 meses", p: "12m", dimsF: {}, q: {} },
      { name: "año", p: "year", dimsF: {}, q: {} },
      { name: "12m, Área X", p: "12m", dimsF: { AREA: { ids: [uid("AREA", "X")], none: false } }, q: { area: { ids: ["X"], none: false } } },
      { name: "año, Área Y (cambio de área de P4)", p: "year", dimsF: { AREA: { ids: [uid("AREA", "Y")], none: false } }, q: { area: { ids: ["Y"], none: false } } },
      { name: "12m, Área sin asignar", p: "12m", dimsF: { AREA: none }, q: { area: { ids: [], none: true } } },
      { name: "12m, Sucursal Sur + Área X o Y", p: "12m", dimsF: { LOCATION: { ids: [uid("LOCATION", "S")], none: false }, AREA: { ids: [uid("AREA", "X"), uid("AREA", "Y")], none: false } }, q: { location: { ids: ["S"], none: false }, area: { ids: ["X", "Y"], none: false } } },
      { name: "mes, Área sin asignar y Sucursal Norte (menos de 3 personas)", p: "month", dimsF: { AREA: none, LOCATION: { ids: [uid("LOCATION", "N")], none: false } }, q: { area: { ids: [], none: true }, location: { ids: ["N"], none: false } } },
    ];

    let failures = 0;
    for (const withRefs of [true, false]) {
      if (!withRefs) {
        // Sin acumuladores marcados: la masa bruta sale de las clases de haber
        await withTenantContext(tenantId, (tx) => tx.payConcept.updateMany({ where: { tenantId, referenceTotal: { not: null } }, data: { referenceTotal: null } }));
      }
      for (const c of cases) {
        const filters: PayrollFilters = { p: c.p, dims: c.dimsF };
        const data = await loadPayroll(tenantId, filters, dims);
        const label = `[${withRefs ? "con bruto/neto" : "sin bruto/neto"}] ${c.name}`;
        const fails: string[] = [];
        if (data.status !== "ok") { console.log(`✗ ${label}: estado ${data.status}`); failures++; continue; }
        const per = buildPeriod(c.p, REF);
        const curMonths = monthsOf(per.start, REF);
        const prevMonths = monthsOf(per.prevStart, per.prevEnd);
        const l12 = monthsOf(addMonths(REF, -11), REF);
        const win = monthsOf(addMonths(REF, -23), REF);
        const b = brute(win, c.q, withRefs);
        const basisOf = (cell: Cell) => (withRefs ? (cell.amt.get("gross") ?? 0) : cell.earn);
        const maxPersons = Math.max(0, ...curMonths.map((m) => b.monthly.get(m)!.persons.size));
        const restricted = maxPersons > 0 && maxPersons < 3;
        if (data.restricted !== restricted) fails.push(`restringido: motor ${data.restricted} vs independiente ${restricted}`);

        if (!restricted) {
          const gross = sumM(b.monthly, curMonths, basisOf);
          const pm = sumM(b.monthly, curMonths, (x) => x.persons.size);
          const hasCur = pm > 0;
          near(data.kpis.gross.value, hasCur ? gross : null, "masa bruta", fails);
          near(data.kpis.perPerson.value, hasCur ? gross / pm : null, "costo medio por persona", fails);
          const pmPrev = sumM(b.monthly, prevMonths, (x) => x.persons.size);
          near(data.kpis.gross.prev, prevMonths.length && pmPrev > 0 ? sumM(b.monthly, prevMonths, basisOf) : null, "masa bruta previa", fails);
          near(data.kpis.perPerson.prev, prevMonths.length && pmPrev > 0 ? sumM(b.monthly, prevMonths, basisOf) / pmPrev : null, "costo medio previo", fails);
          const avg12 = c.p !== "12m" && l12.length >= 6 ? (sumM(b.monthly, l12, basisOf) / l12.length) * per.months : null;
          near(data.kpis.gross.avg, avg12, "promedio 12m", fails);
          near(data.kpis.net.value, withRefs && hasCur ? sumM(b.monthly, curMonths, (x) => x.amt.get("net") ?? 0) : null, "neto pagado", fails);
          const ot = sumM(b.monthly, curMonths, (x) => x.amt.get("horas_extra") ?? 0);
          const sal = sumM(b.monthly, curMonths, (x) => x.amt.get("sueldo") ?? 0);
          near(data.kpis.overtime.value, hasCur ? ot : null, "horas extra", fails);
          near(data.kpis.overtime.pctOfSalary, hasCur && sal !== 0 ? (ot / sal) * 100 : null, "% horas extra sobre sueldo", fails);

          // Composición por clase
          const comp = new Map([...data.composition.earnings, ...data.composition.deductions].map((i) => [i.label, i.amount]));
          const NAMES: Record<string, string> = { sueldo: "Sueldo", horas_extra: "Horas extra", bonos: "Bonos", otros_haberes: "Otros haberes", impuestos: "Impuestos y aportes", otras_retenciones: "Otras retenciones" };
          for (const [code, name] of Object.entries(NAMES)) {
            const exp = sumM(b.monthly, curMonths, (x) => x.amt.get(code) ?? 0);
            near(comp.get(name) ?? 0, exp, `clase ${name}`, fails);
          }
          near(data.composition.unclassified?.amount ?? 0, sumM(b.monthly, curMonths, (x) => x.amt.get("uncl") ?? 0), "sin clasificar", fails);

          // Por dimensión
          for (const dim of data.dimensions) {
            const g = brute(curMonths, c.q, withRefs, { type: dim.code as "AREA" | "LOCATION" }).units;
            const seen = new Set<string>();
            for (const it of dim.items) {
              const code = it.key === "none" ? "none" : [...ids].find(([, v]) => String(v) === it.key)![0].split(":")[1]!;
              seen.add(code);
              const row = g.get(code)?.get("all");
              near(it.persons, row?.persons.size ?? 0, `${dim.code}/${code}: personas`, fails);
              const hidden = (row?.persons.size ?? 0) < 3;
              if (it.hidden !== hidden) fails.push(`${dim.code}/${code}: reservado motor ${it.hidden} vs ${hidden}`);
              near(it.cost, !hidden && row ? row.gross / row.pm : null, `${dim.code}/${code}: costo medio`, fails);
              near(it.total, !hidden && row ? row.gross : null, `${dim.code}/${code}: masa`, fails);
            }
            for (const [code, row] of g) if (row.get("all")!.pm > 0 && !seen.has(code)) fails.push(`${dim.code}/${code}: falta en el motor`);
          }
        } else {
          near(data.kpis.gross.value, null, "restringido: masa bruta oculta", fails);
        }

        // Evolución: sin datos, reservado o con importe
        for (const pt of data.series) {
          const cell = b.monthly.get(pt.month);
          const persons = cell?.persons.size ?? 0;
          const exp = !COVERED.has(pt.month) || persons === 0 ? "nodata" : persons < 3 ? "hidden" : "ok";
          if (pt.state !== exp) fails.push(`serie ${pt.month}: estado ${pt.state} vs ${exp}`);
          else if (exp === "ok") {
            near(pt.gross, basisOf(cell!), `serie ${pt.month}`, fails);
            near(pt.net, withRefs ? (cell!.amt.get("net") ?? 0) : null, `serie neto ${pt.month}`, fails);
          }
        }

        // Detalle: procesos
        if (!restricted) {
          const dp = await loadDetail(tenantId, filters, dims, "procesos", [], { page: 1, q: "" });
          if (dp.status !== "ok" || dp.kind !== "procesos") fails.push("detalle procesos: " + dp.status);
          else {
            const expProc = new Map<string, { gross: number; persons: Set<string> }>();
            for (const e of entries) {
              if (!curMonths.includes(e.month)) continue;
              const p = byCode.get(e.person)!;
              if (!passUnits(c.q, p, monthEnd(e.month))) continue;
              const k = keyOf(e.concept, withRefs);
              if (!k) continue;
              const isEarn = k in CLASS_SIDE && CLASS_SIDE[k] === "earning";
              if (!(withRefs ? k === "gross" : isEarn)) continue;
              const pk = `${e.month.slice(0, 7)}|${e.process}`;
              const row = expProc.get(pk) ?? { gross: 0, persons: new Set() };
              row.gross += e.amount;
              row.persons.add(e.person);
              expProc.set(pk, row);
            }
            near(dp.rows.length, expProc.size, "procesos: cantidad", fails);
            for (const r of dp.rows) {
              const exp = expProc.get(`${r.month.slice(0, 7)}|${r.code}`);
              near(r.persons, exp?.persons.size ?? 0, `proceso ${r.code}: personas`, fails);
              const hidden = (exp?.persons.size ?? 0) < 3;
              near(r.gross, hidden ? null : (exp?.gross ?? null), `proceso ${r.code}: masa`, fails);
            }
          }
          // Detalle: clase Sueldo
          const sueldoId = String(data.composition.earnings.find((i) => i.label === "Sueldo")?.key ?? "");
          if (sueldoId) {
            const dc = await loadDetail(tenantId, filters, dims, "clase", [sueldoId], { page: 1, q: "" });
            if (dc.status !== "ok" || dc.kind !== "clase") fails.push("detalle clase: " + dc.status);
            else {
              const expSal = sumM(b.monthly, curMonths, (x) => x.amt.get("sueldo") ?? 0);
              const sum = dc.rows.reduce((s, r) => s + (r.amount ?? 0), 0);
              if (dc.rows.every((r) => r.amount !== null)) near(sum, expSal, "detalle clase Sueldo: total", fails);
              const codes = dc.rows.map((r) => r.code).sort().join(",");
              const hasSac = curMonths.some((m) => ["06", "12"].includes(m.slice(5, 7)));
              if (codes !== (hasSac ? "SAC,SUELDO" : "SUELDO")) fails.push(`detalle clase Sueldo: conceptos ${codes}`);
            }
          }
          // Detalle: personas (orden por masa descendente; suma = masa bruta del período)
          const dpe = await loadDetail(tenantId, filters, dims, "personas", [], { page: 1, q: "" }, { all: true });
          if (dpe.status !== "ok" || dpe.kind !== "personas") fails.push("detalle personas: " + dpe.status);
          else {
            const gross = sumM(b.monthly, curMonths, basisOf);
            near(dpe.rows.reduce((s, r) => s + r.gross, 0), gross, "personas: suma = masa bruta", fails);
            for (let i = 1; i < dpe.rows.length; i++) if (dpe.rows[i]!.gross > dpe.rows[i - 1]!.gross) { fails.push("personas: no está ordenado por masa descendente"); break; }
          }
        }

        if (fails.length === 0) console.log(`✓ ${label}`);
        else {
          failures++;
          console.log(`✗ ${label}`);
          for (const f of fails) console.log(`    ${f}`);
        }
      }
    }

    // Detalle de unidad: composición del Área X en el año, con bruto y neto marcados otra vez
    {
      await withTenantContext(tenantId, async (tx) => {
        await tx.payConcept.updateMany({ where: { tenantId, code: "BRUTO" }, data: { referenceTotal: "gross" } });
        await tx.payConcept.updateMany({ where: { tenantId, code: "NETO" }, data: { referenceTotal: "net" } });
      });
      const filters: PayrollFilters = { p: "year", dims: {} };
      const dd = await loadDetail(tenantId, filters, dims, "dim", ["area", String(uid("AREA", "X"))], { page: 1, q: "" });
      const fails: string[] = [];
      if (dd.status !== "ok" || dd.kind !== "dim") fails.push("detalle unidad: " + dd.status);
      else {
        const per = buildPeriod("year", REF);
        const months = monthsOf(per.start, REF);
        const b = brute(months, { area: { ids: ["X"], none: false } }, true);
        near(dd.gross, sumM(b.monthly, months, (x) => x.amt.get("gross") ?? 0), "unidad: masa bruta", fails);
        const sueldo = dd.composition.earnings.find((i) => i.label === "Sueldo")?.amount ?? 0;
        near(sueldo, sumM(b.monthly, months, (x) => x.amt.get("sueldo") ?? 0), "unidad: Sueldo", fails);
      }
      if (fails.length === 0) console.log("✓ detalle de unidad (Área X, año)");
      else {
        failures++;
        console.log("✗ detalle de unidad");
        for (const f of fails) console.log(`    ${f}`);
      }
    }

    console.log(failures === 0 ? "\nTodo OK" : `\n${failures} caso(s) fallaron`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await withTenantContext(
      tenantId,
      async (tx) => {
        for (const t of ["pay_entries", "pay_processes", "pay_periods", "pay_class_rules", "pay_concept_classes", "pay_concepts", "hr_people_org_assignments", "hr_people", "hr_org_units", "dsh_dimensions", "cfg_tenant_org_unit_types", "cfg_tenant_settings"]) {
          await tx.$executeRawUnsafe(`DELETE FROM ${t} WHERE tenant_id = '${tenantId}'::uuid`);
        }
      },
      { timeout: 120_000 }
    );
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
