/**
 * Verificación del cálculo de rotación contra una implementación independiente que parte de las fechas de ingreso
 * y baja (no de los cierres). Crea un tenant temporal con casos de borde, genera sus cierres mensuales, compara y
 * lo borra. Uso (desde apps/cliente):
 *   ../../packages/db/node_modules/.bin/tsx --env-file=.env.local scripts/verify-turnover-engine.ts
 *
 * Casos: ingreso y baja en el mismo mes (nunca figura en un cierre pero cuenta como baja), baja el último día del
 * mes (no está en el cierre de ese mes), cambio de área antes de la baja (la baja cuenta en el área vigente ese día),
 * persona sin unidades, baja sin motivo, antigüedad justo de 12 meses (no es temprana), filtros por unidad,
 * categoría y motivo, y el primer mes sin apertura.
 */
import { prisma, applyDefaultOrgConfig, rebuildPeopleSnapshots } from "@wla/db";
import { withTenantContext } from "@wla/auth";
import { loadDetail } from "../app/(dashboard)/turnover/_data/detail-queries";
import { loadTurnover } from "../app/(dashboard)/turnover/_data/queries";
import type { TurnoverFilters } from "../app/(dashboard)/turnover/_data/filters";
import { addMonths, buildPeriod, monthEnd } from "../app/(dashboard)/_dashboard-kit/period";
import type { Dimension } from "../app/(dashboard)/_dashboard-kit/dimensions";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

// ── Fixtures (el cálculo independiente lee SOLO esto, no la base) ───────────────────────────────────────────
interface Assign { type: "AREA" | "LOCATION"; unit: string; from: string; to: string | null }
interface Person { code: string; hire: string; term: string | null; reason: string | null; assigns: Assign[] }

const CATEGORY: Record<string, string> = {
  VOLUNTARY_RESIGNATION: "voluntary",
  BETTER_OFFER: "voluntary",
  DISMISSAL: "involuntary",
  END_OF_CONTRACT: "end_of_contract",
  RETIREMENT: "retirement",
  MUTUAL_AGREEMENT: "other",
};

const A = (type: Assign["type"], unit: string, from: string, to: string | null = null): Assign => ({ type, unit, from, to });
const people: Person[] = [
  { code: "P1", hire: "2024-01-10", term: null, reason: null, assigns: [A("AREA", "X", "2024-01-10"), A("LOCATION", "N", "2024-01-10")] },
  { code: "P2", hire: "2024-06-01", term: "2026-09-15", reason: "VOLUNTARY_RESIGNATION", assigns: [A("AREA", "X", "2024-06-01", "2026-08-31"), A("AREA", "Y", "2026-09-01"), A("LOCATION", "N", "2024-06-01")] },
  { code: "P3", hire: "2025-03-05", term: "2025-12-31", reason: "DISMISSAL", assigns: [A("AREA", "Y", "2025-03-05"), A("LOCATION", "S", "2025-03-05")] },
  { code: "P4", hire: "2026-09-01", term: "2026-09-20", reason: "END_OF_CONTRACT", assigns: [A("AREA", "X", "2026-09-01")] },
  { code: "P5", hire: "2025-11-30", term: null, reason: null, assigns: [A("LOCATION", "N", "2025-11-30")] },
  { code: "P6", hire: "2023-05-15", term: "2026-08-15", reason: "BETTER_OFFER", assigns: [A("AREA", "Y", "2023-05-15"), A("LOCATION", "S", "2023-05-15")] },
  { code: "P7", hire: "2025-08-10", term: "2026-03-10", reason: "RETIREMENT", assigns: [A("AREA", "X", "2025-08-10")] },
  { code: "P8", hire: "2025-02-01", term: "2026-01-15", reason: null, assigns: [A("LOCATION", "N", "2025-02-01")] },
  { code: "P9", hire: "2024-09-20", term: "2026-09-10", reason: "MUTUAL_AGREEMENT", assigns: [A("AREA", "Y", "2024-09-20"), A("LOCATION", "S", "2024-09-20")] },
  { code: "P10", hire: "2025-09-15", term: "2026-09-15", reason: "DISMISSAL", assigns: [A("AREA", "X", "2025-09-15"), A("LOCATION", "N", "2025-09-15")] },
  { code: "P11", hire: "2026-02-14", term: "2026-08-14", reason: "VOLUNTARY_RESIGNATION", assigns: [A("AREA", "X", "2026-02-14"), A("LOCATION", "N", "2026-02-14")] },
  { code: "P12", hire: "2022-01-05", term: null, reason: null, assigns: [A("AREA", "Y", "2022-01-05"), A("LOCATION", "S", "2022-01-05")] },
];

// ── Cálculo independiente ───────────────────────────────────────────────────────────────────────────────────
const unitAt = (p: Person, type: string, day: string): string | null =>
  p.assigns.find((a) => a.type === type && a.from <= day && (a.to === null || a.to >= day))?.unit ?? null;

/** Meses cumplidos entre el ingreso y la baja (misma regla que age() de Postgres para las fechas de la prueba) */
function tenure(p: Person): number {
  const h = d(p.hire), t = d(p.term!);
  let m = (t.getUTCFullYear() - h.getUTCFullYear()) * 12 + (t.getUTCMonth() - h.getUTCMonth());
  if (t.getUTCDate() < h.getUTCDate()) m--;
  return m;
}

interface DimSel { ids: string[]; none: boolean }
interface Q { area?: DimSel; location?: DimSel; categories?: string[]; reasons?: string[] }
const pass = (sel: DimSel | undefined, unit: string | null) => !sel || (unit === null ? sel.none : sel.ids.includes(unit));
const passUnits = (q: Q, p: Person, day: string) => pass(q.area, unitAt(p, "AREA", day)) && pass(q.location, unitAt(p, "LOCATION", day));
const passReason = (q: Q, p: Person) => {
  if (q.categories?.length && !(p.reason && q.categories.includes(CATEGORY[p.reason]!))) return false;
  if (q.reasons?.length && !(p.reason && q.reasons.includes(p.reason))) return false;
  return true;
};

const monthsOf = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
};
/** Headcount al cierre de un mes (filtros de unidad del cierre) */
const hcAt = (m: string, q: Q, by?: "AREA" | "LOCATION") => {
  const end = monthEnd(m);
  const out = new Map<string, number>();
  let total = 0;
  for (const p of people) {
    if (p.hire > end || (p.term !== null && p.term <= end)) continue;
    if (!passUnits(q, p, end)) continue;
    total++;
    if (by) {
      const u = unitAt(p, by, end) ?? "none";
      out.set(u, (out.get(u) ?? 0) + 1);
    }
  }
  return { total, by: out };
};

interface Res {
  bajas: number; vol: number; early: number; tenureSum: number; avg: number | null;
  byCat: Map<string, number>; byReason: Map<string, number>;
  unit: Map<string, { bajas: number; avg: number }>;
}
function brute(from: string, to: string, q: Q, byDim?: "AREA" | "LOCATION"): Res {
  const open = addMonths(from, -1);
  const closings = monthsOf(open, to);
  const avg = closings.reduce((s, m) => s + hcAt(m, q).total, 0) / closings.length;
  const r: Res = { bajas: 0, vol: 0, early: 0, tenureSum: 0, avg, byCat: new Map(), byReason: new Map(), unit: new Map() };
  const start = from, endD = monthEnd(to);
  for (const p of people) {
    if (p.term === null || p.term < start || p.term > endD) continue;
    if (!passUnits(q, p, p.term) || !passReason(q, p)) continue;
    r.bajas++;
    const cat = p.reason ? CATEGORY[p.reason]! : "unspecified";
    if (cat === "voluntary") r.vol++;
    r.byCat.set(cat, (r.byCat.get(cat) ?? 0) + 1);
    r.byReason.set(p.reason ?? "unspecified", (r.byReason.get(p.reason ?? "unspecified") ?? 0) + 1);
    const t = tenure(p);
    r.tenureSum += t;
    if (t < 12) r.early++;
    if (byDim) {
      const u = unitAt(p, byDim, p.term) ?? "none";
      const cur = r.unit.get(u) ?? { bajas: 0, avg: 0 };
      cur.bajas++;
      r.unit.set(u, cur);
    }
  }
  if (byDim) {
    const sums = new Map<string, number>();
    for (const m of closings) for (const [u, n] of hcAt(m, q, byDim).by) sums.set(u, (sums.get(u) ?? 0) + n);
    for (const [u, sum] of sums) {
      const cur = r.unit.get(u) ?? { bajas: 0, avg: 0 };
      cur.avg = sum / closings.length;
      r.unit.set(u, cur);
    }
  }
  return r;
}
const rate = (num: number, avg: number | null) => (avg !== null && avg > 0 ? (num / avg) * 100 : null);

const near = (a: number | null, b: number | null, label: string, fails: string[]) => {
  if (a === null || b === null) {
    if (a !== b) fails.push(`${label}: ${a} vs ${b}`);
    return;
  }
  if (Math.abs(a - b) > 1e-6) fails.push(`${label}: motor ${a} vs independiente ${b}`);
};

async function main() {
  const slug = "tmp-to-verify";
  await prisma.tenant.deleteMany({ where: { slug } }).catch(() => undefined);
  const tenant = await prisma.tenant.create({ data: { slug, name: "TMP verify turnover" } });
  const tenantId = tenant.id;
  const ids = new Map<string, number>();
  try {
    await withTenantContext(tenantId, async (tx) => {
      await applyDefaultOrgConfig(tx, tenantId);
      for (const [type, code, name] of [["AREA", "X", "Área X"], ["AREA", "Y", "Área Y"], ["LOCATION", "N", "Norte"], ["LOCATION", "S", "Sur"]] as const) {
        const u = await tx.hrOrgUnit.create({ data: { tenantId, orgUnitTypeCode: type, code, name, isActive: true, level: 0 } });
        ids.set(`${type}:${code}`, u.id);
      }
      for (const p of people) {
        const row = await tx.hrPerson.create({
          data: { tenantId, employeeCode: p.code, fullName: p.code, hireDate: d(p.hire), terminationDate: p.term ? d(p.term) : null, terminationReasonCode: p.reason, status: p.term ? "inactive" : "active" },
        });
        for (const a of p.assigns) {
          await tx.hrPeopleOrgAssignment.create({ data: { tenantId, personId: row.id, orgUnitId: ids.get(`${a.type}:${a.unit}`)!, orgUnitTypeCode: a.type, validFrom: d(a.from), validTo: a.to ? d(a.to) : null } });
        }
      }
      await rebuildPeopleSnapshots(tx, tenantId, "2025-01-01", "2026-09-01");
    }, { timeout: 120_000 });

    const dims: Dimension[] = [
      { code: "AREA", name: "Área", slug: "area" },
      { code: "LOCATION", name: "Sucursal", slug: "location" },
    ];
    const uid = (type: string, c: string) => ids.get(`${type}:${c}`)!;
    const none = { ids: [] as number[], none: true };
    const cases: { name: string; p: TurnoverFilters["p"]; dimsF: TurnoverFilters["dims"]; categories?: string[]; reasons?: string[]; q: Q }[] = [
      { name: "mes", p: "month", dimsF: {}, q: {} },
      { name: "12 meses", p: "12m", dimsF: {}, q: {} },
      { name: "año", p: "year", dimsF: {}, q: {} },
      { name: "12m, Área X", p: "12m", dimsF: { AREA: { ids: [uid("AREA", "X")], none: false } }, q: { area: { ids: ["X"], none: false } } },
      { name: "12m, Área sin asignar", p: "12m", dimsF: { AREA: none }, q: { area: { ids: [], none: true } } },
      { name: "año, Sucursal sin asignar", p: "year", dimsF: { LOCATION: none }, q: { location: { ids: [], none: true } } },
      { name: "12m, Áreas Y o sin asignar + Sucursal Sur", p: "12m", dimsF: { AREA: { ids: [uid("AREA", "Y")], none: true }, LOCATION: { ids: [uid("LOCATION", "S")], none: false } }, q: { area: { ids: ["Y"], none: true }, location: { ids: ["S"], none: false } } },
      { name: "12m, categoría voluntaria", p: "12m", dimsF: {}, categories: ["voluntary"], q: { categories: ["voluntary"] } },
      { name: "año, categorías voluntaria e involuntaria + Área Y", p: "year", dimsF: { AREA: { ids: [uid("AREA", "Y")], none: false } }, categories: ["voluntary", "involuntary"], q: { area: { ids: ["Y"], none: false }, categories: ["voluntary", "involuntary"] } },
      { name: "12m, motivo DISMISSAL", p: "12m", dimsF: {}, reasons: ["DISMISSAL"], q: { reasons: ["DISMISSAL"] } },
    ];

    const REF = "2026-09-01";
    const FIRST = "2025-01-01";
    let failures = 0;
    for (const c of cases) {
      const filters: TurnoverFilters = { p: c.p, dims: c.dimsF, categories: c.categories ?? [], reasons: c.reasons ?? [] };
      const data = await loadTurnover(tenantId, filters, dims);
      const fails: string[] = [];
      if (data.status !== "ok") { console.log(`✗ ${c.name}: estado ${data.status}`); failures++; continue; }
      const per = buildPeriod(c.p, REF);
      const effStart = per.start > addMonths(FIRST, 1) ? per.start : addMonths(FIRST, 1);
      const months = monthsOf(effStart, REF).length;
      const cur = brute(effStart, REF, c.q);

      near(data.kpis.rate.value, rate(cur.bajas, cur.avg), "rotación", fails);
      near(data.kpis.rate.target, (18 * months) / 12, "meta prorrateada", fails);
      near(data.kpis.voluntary.value, rate(cur.vol, cur.avg), "rotación voluntaria", fails);
      near(data.kpis.bajas.value, cur.bajas, "bajas", fails);
      near(data.kpis.early.value, cur.early, "bajas tempranas", fails);
      near(data.kpis.early.pct, cur.bajas > 0 ? (cur.early / cur.bajas) * 100 : null, "% bajas tempranas", fails);
      near(data.kpis.early.avgTenureMonths, cur.bajas > 0 ? cur.tenureSum / cur.bajas : null, "antigüedad promedio", fails);
      near(data.avgHeadcount, cur.avg, "headcount promedio", fails);
      if (addMonths(per.prevStart, -1) >= FIRST) {
        const prev = brute(per.prevStart, per.prevRefMonth, c.q);
        near(data.kpis.rate.prev, rate(prev.bajas, prev.avg), "rotación previa", fails);
        near(data.kpis.bajas.prev, prev.bajas, "bajas previas", fails);
        near(data.kpis.early.prev, prev.early, "tempranas previas", fails);
      } else {
        near(data.kpis.rate.prev, null, "rotación previa (sin apertura)", fails);
        near(data.kpis.bajas.prev, null, "bajas previas (sin apertura)", fails);
      }

      // Categoría y motivo
      for (const it of data.byCategory) near(it.count, cur.byCat.get(it.key) ?? 0, `categoría ${it.key}`, fails);
      for (const [k, v] of cur.byCat) if (v > 0 && !data.byCategory.find((i) => i.key === k)) fails.push(`categoría ${k}: falta en el motor`);
      for (const it of data.byReason) near(it.count, cur.byReason.get(it.key) ?? 0, `motivo ${it.key}`, fails);
      for (const [k, v] of cur.byReason) if (v > 0 && !data.byReason.find((i) => i.key === k)) fails.push(`motivo ${k}: falta en el motor`);

      // Evolución de 12 meses: el primer mes sin apertura figura sin datos
      for (const pt of data.series) {
        const m = brute(pt.month, pt.month, c.q);
        const hasOpening = addMonths(pt.month, -1) >= FIRST;
        near(pt.rate, hasOpening ? rate(m.bajas, m.avg) : null, `serie ${pt.month}`, fails);
        near(pt.bajas, m.bajas, `serie bajas ${pt.month}`, fails);
      }
      // Por dimensión
      for (const dim of data.dimensions) {
        const g = brute(effStart, REF, c.q, dim.code as "AREA" | "LOCATION");
        const seen = new Set<string>();
        for (const it of dim.items) {
          const code = it.key === "none" ? "none" : [...ids].find(([, v]) => String(v) === it.key)![0].split(":")[1]!;
          seen.add(code);
          const gg = g.unit.get(code);
          near(it.bajas, gg?.bajas ?? 0, `${dim.code}/${code}: bajas`, fails);
          near(it.avgHeadcount, gg?.avg ?? 0, `${dim.code}/${code}: headcount promedio`, fails);
          near(it.rate, gg && gg.avg > 0 ? (gg.bajas / gg.avg) * 100 : null, `${dim.code}/${code}: tasa`, fails);
        }
        for (const [code, gg] of g.unit) if ((gg.bajas > 0 || gg.avg > 0) && !seen.has(code)) fails.push(`${dim.code}/${code}: falta en el motor`);
      }

      // Detalle (drill-down): debe sumar lo mismo que el resumen
      const asked = { page: 1, q: "" } as const;
      const all = { all: true } as const;
      const dBa = await loadDetail(tenantId, filters, dims, "bajas", [], asked, all);
      if (dBa.status !== "ok") fails.push("detalle bajas: " + dBa.status);
      else {
        near(dBa.total, data.kpis.bajas.value, "detalle bajas: total", fails);
        near(dBa.rows.length, data.kpis.bajas.value, "detalle bajas: filas", fails);
        near(dBa.early, data.kpis.early.value, "detalle bajas: tempranas", fails);
        for (let i = 1; i < dBa.rows.length; i++) if (dBa.rows[i]!.terminationDate > dBa.rows[i - 1]!.terminationDate) { fails.push("detalle bajas: no está ordenado por fecha de baja descendente"); break; }
        for (const r of dBa.rows) {
          const p = people.find((x) => x.code === r.code)!;
          if (r.terminationDate !== p.term || r.tenureMonths !== tenure(p)) fails.push(`detalle bajas ${r.code}: fecha o antigüedad distintas`);
        }
      }
      const dTe = await loadDetail(tenantId, filters, dims, "tempranas", [], asked, all);
      if (dTe.status !== "ok") fails.push("detalle tempranas: " + dTe.status);
      else near(dTe.total, data.kpis.early.value, "detalle tempranas: total", fails);
      for (const it of data.byCategory) {
        const x = await loadDetail(tenantId, filters, dims, "categoria", [it.key], asked, all);
        if (x.status !== "ok") { fails.push(`detalle categoría ${it.key}: ${x.status}`); continue; }
        near(x.total, it.count, `detalle categoría ${it.key}`, fails);
      }
      for (const it of data.byReason) {
        const x = await loadDetail(tenantId, filters, dims, "motivo", [it.key], asked, all);
        if (x.status !== "ok") { fails.push(`detalle motivo ${it.key}: ${x.status}`); continue; }
        near(x.total, it.count, `detalle motivo ${it.key}`, fails);
      }
      for (const dim of data.dimensions) {
        for (const it of dim.items) {
          const x = await loadDetail(tenantId, filters, dims, "dim", [dim.slug, it.key], asked, all);
          if (x.status !== "ok") { fails.push(`detalle ${dim.code}/${it.key}: ${x.status}`); continue; }
          near(x.total, it.bajas, `detalle ${dim.code}/${it.key}`, fails);
        }
      }
      for (const [sc, seg] of [["categoria", "inventada"], ["motivo", "NO_EXISTE"], ["dim", "area"]] as const) {
        const x = await loadDetail(tenantId, filters, dims, sc, [seg], asked);
        if (x.status !== "notfound") fails.push(`detalle ${sc}/${seg}: debería ser notfound`);
      }

      if (fails.length) {
        failures++;
        console.log(`✗ ${c.name}\n   - ${fails.join("\n   - ")}`);
      } else {
        console.log(`✓ ${c.name}: rotación ${data.kpis.rate.value?.toFixed(3) ?? "-"} % (meta ${data.kpis.rate.target.toFixed(2)} %) · ${data.kpis.bajas.value} bajas · ${data.kpis.early.value} tempranas · hc prom ${data.avgHeadcount?.toFixed(2)}`);
      }
    }

    console.log(failures === 0 ? "\nTODOS LOS CASOS COINCIDEN" : `\n${failures} CASO(S) CON DIFERENCIAS`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await withTenantContext(tenantId, async (tx) => {
      for (const t of ["hr_people_history", "hr_people_org_assignments", "hr_people", "hr_org_units", "dsh_dimensions", "cfg_tenant_org_unit_types"]) {
        await tx.$executeRawUnsafe(`DELETE FROM ${t} WHERE tenant_id = '${tenantId}'::uuid`);
      }
    }, { timeout: 120_000 });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
