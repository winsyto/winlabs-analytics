/**
 * Verificación del motor de horas extra contra una implementación independiente (día por día, en JS).
 * Crea un tenant temporal con casos de borde, compara y lo borra. Uso (desde apps/cliente):
 *   ../../packages/db/node_modules/.bin/tsx --env-file=.env.local scripts/verify-overtime-engine.ts
 *
 * Casos: cobertura por persona y mes (una persona sin horas en un mes no entra en el denominador), cabeceras sin
 * horas por tipo (no son cobertura), cambio de unidad y de turno dentro del mes, baja a mitad de mes (las horas
 * posteriores a la baja no cuentan), persona sin unidades, ingreso a mitad de mes, horas en días no laborables,
 * horas extra no autorizadas (fuera de la tasa), tipos de otra categoría (no cuentan), filtro por tipo, base
 * `worked` y filtros por unidad con "Sin asignar".
 */
import { prisma, applyDefaultOrgConfig, applyDefaultTenantSettings } from "@wla/db";
import { withTenantContext } from "@wla/auth";
import { loadDetail } from "../app/(dashboard)/overtime/_data/detail-queries";
import { loadOvertime } from "../app/(dashboard)/overtime/_data/queries";
import type { OvertimeFilters } from "../app/(dashboard)/overtime/_data/filters";
import { buildPeriod } from "../app/(dashboard)/_dashboard-kit/period";
import type { Dimension } from "../app/(dashboard)/_dashboard-kit/dimensions";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const addDay = (x: Date, n: number) => new Date(x.getTime() + n * 86400000);
const monthOf = (day: string) => day.slice(0, 7);

// ── Fixtures (definidos acá; el cálculo independiente lee SOLO esto, no la base) ─────────────────────────────
interface Assign { type: "AREA" | "SHIFT"; unit: string; from: string; to: string | null }
interface Person { code: string; hire: string; term: string | null; assigns: Assign[]; windows: [string, string][]; stray?: string[]; headerOnly?: [string, string] }
interface Entry { code: string; day: string; type: string; hours: number }

const SHIFTS = { A: { week: "1111100", dh: 8 }, B: { week: "1111110", dh: 6 } } as Record<string, { week: string; dh: number }>;
const DEFAULT = { week: "1111100", dh: 8 };
/** category y sign de los tipos de hora de la prueba */
const TYPES: Record<string, { category: string; sign: 1 | -1 }> = {
  REGULAR: { category: "regular", sign: 1 },
  TRAINING: { category: "training", sign: 1 },
  OT50: { category: "overtime", sign: 1 },
  OT100: { category: "overtime", sign: 1 },
  OT50NA: { category: "overtime_na", sign: 1 },
  HG: { category: "other", sign: 1 }, // tipo sin clasificar: no es hora extra
  ABSENT: { category: "absence", sign: -1 },
};

const people: Person[] = [
  { code: "P1", hire: "2025-01-01", term: null, windows: [["2026-03-01", "2026-09-30"]],
    assigns: [{ type: "AREA", unit: "X", from: "2025-01-01", to: null }, { type: "SHIFT", unit: "A", from: "2025-01-01", to: null }] },
  { code: "P2", hire: "2025-06-01", term: null, windows: [["2026-08-01", "2026-09-30"]],
    assigns: [
      { type: "AREA", unit: "X", from: "2025-06-01", to: "2026-09-09" }, { type: "AREA", unit: "Y", from: "2026-09-10", to: null },
      { type: "SHIFT", unit: "A", from: "2025-06-01", to: "2026-08-15" }, { type: "SHIFT", unit: "B", from: "2026-08-16", to: null }] },
  { code: "P3", hire: "2024-01-01", term: "2026-08-20", windows: [["2026-07-01", "2026-08-19"]], stray: ["2026-08-24", "2026-08-25"],
    assigns: [{ type: "AREA", unit: "Y", from: "2024-01-01", to: null }, { type: "SHIFT", unit: "B", from: "2024-01-01", to: null }] },
  { code: "P4", hire: "2025-01-01", term: null, windows: [["2026-09-01", "2026-09-10"]], assigns: [] },
  { code: "P5", hire: "2026-09-10", term: null, windows: [["2026-09-10", "2026-09-30"]],
    assigns: [{ type: "AREA", unit: "X", from: "2026-09-10", to: null }, { type: "SHIFT", unit: "A", from: "2026-09-10", to: null }] },
  { code: "P6", hire: "2025-01-01", term: null, windows: [["2026-07-01", "2026-07-31"]], headerOnly: ["2026-09-01", "2026-09-05"],
    assigns: [{ type: "AREA", unit: "Y", from: "2025-01-01", to: null }, { type: "SHIFT", unit: "A", from: "2025-01-01", to: null }] },
];

// ── Cálculo independiente (día por día) ─────────────────────────────────────────────────────────────────────
const unitAt = (p: Person, type: string, day: string): string | null =>
  p.assigns.find((a) => a.type === type && a.from <= day && (a.to === null || a.to >= day))?.unit ?? null;
const sched = (unit: string | null) => (unit ? SHIFTS[unit]! : DEFAULT);
const isWork = (week: string, day: Date) => week[(day.getUTCDay() + 6) % 7] === "1";
const personOf = (c: string) => people.find((p) => p.code === c)!;

/** Genera las horas por tipo de cada persona (determinístico). */
function buildEntries(): Entry[] {
  const out: Entry[] = [];
  people.forEach((p, idx) => {
    const days: string[] = [];
    for (const [f, t] of p.windows) for (let x = d(f); iso(x) <= t; x = addDay(x, 1)) days.push(iso(x));
    for (const s of p.stray ?? []) days.push(s);
    for (const day of days) {
      const dt = d(day);
      const s = sched(unitAt(p, "SHIFT", day));
      if (isWork(s.week, dt)) out.push({ code: p.code, day, type: "REGULAR", hours: s.dh });
      const doy = Math.floor((dt.getTime() - Date.UTC(dt.getUTCFullYear(), 0, 0)) / 86400000);
      const v = (idx * 7 + doy * 13) % 11;
      if (v === 0) out.push({ code: p.code, day, type: "OT50", hours: 1.5 });
      else if (v === 1) out.push({ code: p.code, day, type: "OT100", hours: 2 });
      else if (v === 2) out.push({ code: p.code, day, type: "OT50NA", hours: 1 });
      else if (v === 3) {
        out.push({ code: p.code, day, type: "OT50", hours: 1 });
        out.push({ code: p.code, day, type: "TRAINING", hours: 2 });
        out.push({ code: p.code, day, type: "HG", hours: 1 });
      }
    }
  });
  return out;
}
const entries = buildEntries();
const workedOf = (code: string, day: string) =>
  entries.filter((e) => e.code === code && e.day === day && TYPES[e.type]!.sign === 1).reduce((s, e) => s + e.hours, 0);

interface DimSel { ids: string[]; none: boolean }
interface Q {
  from: string; to: string; // YYYY-MM-DD (inclusive)
  area?: DimSel; shift?: DimSel; types?: string[]; base: "scheduled" | "worked";
  groupBy?: "AREA" | "SHIFT";
}
interface Grp { base: number; hours: number; people: Set<string> }
interface Res {
  base: number; hours: number; naHours: number; ot: Set<string>; covered: Set<string>; all: Set<string>;
  byType: Map<string, number>; naByType: Map<string, number>; groups: Map<string, Grp>;
}

const coveredMonth = (code: string, month: string) => entries.some((e) => e.code === code && monthOf(e.day) === month);

function brute(q: Q): Res {
  const r: Res = { base: 0, hours: 0, naHours: 0, ot: new Set(), covered: new Set(), all: new Set(), byType: new Map(), naByType: new Map(), groups: new Map() };
  const pass = (sel: DimSel | undefined, unit: string | null) => !sel || (unit === null ? sel.none : sel.ids.includes(unit));
  const grp = (k: string) => {
    if (!r.groups.has(k)) r.groups.set(k, { base: 0, hours: 0, people: new Set() });
    return r.groups.get(k)!;
  };
  for (const p of people) {
    for (let day = d(q.from); iso(day) <= q.to; day = addDay(day, 1)) {
      const ds = iso(day);
      if (ds < p.hire || (p.term !== null && ds >= p.term)) continue;
      const area = unitAt(p, "AREA", ds);
      const shift = unitAt(p, "SHIFT", ds);
      if (!pass(q.area, area) || !pass(q.shift, shift)) continue;
      const s = sched(shift);
      const work = isWork(s.week, day);
      const g = q.groupBy ? (q.groupBy === "AREA" ? area : shift) ?? "none" : null;
      if (work) r.all.add(p.code);
      if (!coveredMonth(p.code, monthOf(ds))) continue;
      if (work) r.covered.add(p.code);
      const base = q.base === "worked" ? workedOf(p.code, ds) : work ? s.dh : 0;
      r.base += base;
      if (g) {
        grp(g).base += base;
        if (work) grp(g).people.add(p.code);
      }
      for (const e of entries) {
        if (e.code !== p.code || e.day !== ds) continue;
        const t = TYPES[e.type]!;
        if (t.category !== "overtime" && t.category !== "overtime_na") continue;
        if (q.types?.length && !q.types.includes(e.type)) continue;
        if (t.category === "overtime_na") {
          r.naHours += e.hours;
          r.naByType.set(e.type, (r.naByType.get(e.type) ?? 0) + e.hours);
          continue;
        }
        r.hours += e.hours;
        r.byType.set(e.type, (r.byType.get(e.type) ?? 0) + e.hours);
        r.ot.add(p.code);
        if (g) grp(g).hours += e.hours;
      }
    }
  }
  return r;
}

// ── Ejecución ───────────────────────────────────────────────────────────────────────────────────────────────
const near = (a: number | null, b: number | null, label: string, fails: string[]) => {
  if (a === null || b === null) {
    if (a !== b) fails.push(`${label}: ${a} vs ${b}`);
    return;
  }
  if (Math.abs(a - b) > 1e-6) fails.push(`${label}: motor ${a} vs independiente ${b}`);
};
const monthEndOf = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return iso(new Date(Date.UTC(y, mo, 0)));
};

async function main() {
  const slug = "tmp-ot-verify";
  await prisma.tenant.deleteMany({ where: { slug } }).catch(() => undefined);
  const tenant = await prisma.tenant.create({ data: { slug, name: "TMP verify overtime" } });
  const tenantId = tenant.id;
  const ids = { units: new Map<string, number>(), people: new Map<string, number>() };
  try {
    await withTenantContext(tenantId, async (tx) => {
      await applyDefaultOrgConfig(tx, tenantId);
      await applyDefaultTenantSettings(tx, tenantId);
      // Tipos propios de la prueba (no dependen del catálogo base, que puede tener tipos inactivos)
      for (const [code, t] of Object.entries(TYPES)) {
        await tx.cfgTenantTimeEntryType.create({
          data: { tenantId, code, name: code, category: t.category, sign: t.sign, isClassified: code !== "HG" },
        });
      }
      for (const [type, code, name] of [["AREA", "X", "Área X"], ["AREA", "Y", "Área Y"], ["SHIFT", "A", "Turno A"], ["SHIFT", "B", "Turno B"]] as const) {
        const u = await tx.hrOrgUnit.create({ data: { tenantId, orgUnitTypeCode: type, code, name, isActive: true, level: 0 } });
        ids.units.set(`${type}:${code}`, u.id);
      }
      for (const [code, s] of Object.entries(SHIFTS)) {
        await tx.hrShiftSchedule.create({ data: { tenantId, orgUnitId: ids.units.get(`SHIFT:${code}`)!, orgUnitTypeCode: "SHIFT", dailyHours: s.dh, workWeek: s.week } });
      }
      for (const p of people) {
        const row = await tx.hrPerson.create({ data: { tenantId, employeeCode: p.code, fullName: p.code, hireDate: d(p.hire), terminationDate: p.term ? d(p.term) : null, status: p.term ? "inactive" : "active" } });
        ids.people.set(p.code, row.id);
        for (const a of p.assigns) {
          await tx.hrPeopleOrgAssignment.create({ data: { tenantId, personId: row.id, orgUnitId: ids.units.get(`${a.type}:${a.unit}`)!, orgUnitTypeCode: a.type, validFrom: d(a.from), validTo: a.to ? d(a.to) : null } });
        }
      }
      const typeIds = new Map((await tx.cfgTenantTimeEntryType.findMany({ where: { tenantId } })).map((t) => [t.code, t.id]));
      // Una cabecera por persona y día con horas; los totales salen del fixture, no del motor
      const byDay = new Map<string, Entry[]>();
      for (const e of entries) byDay.set(`${e.code}|${e.day}`, [...(byDay.get(`${e.code}|${e.day}`) ?? []), e]);
      for (const [key, list] of byDay) {
        const [code, day] = key.split("|") as [string, string];
        const daily = await tx.attTimeDaily.create({
          data: { tenantId, personId: ids.people.get(code)!, date: d(day), isWorkingDay: true, workedHours: workedOf(code, day), hasAbsence: false },
        });
        await tx.attTimeDailyEntry.createMany({
          data: list.map((e) => {
            const typeId = typeIds.get(e.type);
            if (typeId === undefined) throw new Error(`Tipo de hora inexistente en el tenant: ${e.type} (hay: ${[...typeIds.keys()].join(", ")})`);
            return { tenantId, timeDailyId: daily.id, timeEntryTypeId: typeId, hours: e.hours };
          }),
        });
      }
      // Cabeceras sin horas por tipo (formato anterior): no son cobertura
      for (const p of people) {
        if (!p.headerOnly) continue;
        for (let x = d(p.headerOnly[0]); iso(x) <= p.headerOnly[1]; x = addDay(x, 1)) {
          await tx.attTimeDaily.create({ data: { tenantId, personId: ids.people.get(p.code)!, date: x, isWorkingDay: true, workedHours: 8 } });
        }
      }
    }, { timeout: 120_000 });

    const dims: Dimension[] = [
      { code: "AREA", name: "Área", slug: "area" },
      { code: "SHIFT", name: "Turno", slug: "shift" },
    ];
    const uid = (type: string, c: string) => ids.units.get(`${type}:${c}`)!;
    const none = { ids: [] as number[], none: true };
    const cases: { name: string; p: OvertimeFilters["p"]; dimsF: OvertimeFilters["dims"]; types?: string[]; base?: "worked"; q: Partial<Q> }[] = [
      { name: "año, sin filtros", p: "year", dimsF: {}, q: {} },
      { name: "mes, sin filtros", p: "month", dimsF: {}, q: {} },
      { name: "12m, sin filtros", p: "12m", dimsF: {}, q: {} },
      { name: "año, Área X", p: "year", dimsF: { AREA: { ids: [uid("AREA", "X")], none: false } }, q: { area: { ids: ["X"], none: false } } },
      { name: "año, Área Y", p: "year", dimsF: { AREA: { ids: [uid("AREA", "Y")], none: false } }, q: { area: { ids: ["Y"], none: false } } },
      { name: "año, Área sin asignar", p: "year", dimsF: { AREA: none }, q: { area: { ids: [], none: true } } },
      { name: "año, Turno A", p: "year", dimsF: { SHIFT: { ids: [uid("SHIFT", "A")], none: false } }, q: { shift: { ids: ["A"], none: false } } },
      { name: "mes, Turno B + Área Y", p: "month", dimsF: { SHIFT: { ids: [uid("SHIFT", "B")], none: false }, AREA: { ids: [uid("AREA", "Y")], none: false } }, q: { shift: { ids: ["B"], none: false }, area: { ids: ["Y"], none: false } } },
      { name: "año, tipo OT50", p: "year", dimsF: {}, types: ["OT50"], q: { types: ["OT50"] } },
      { name: "año, tipo OT100 + OT50NA", p: "year", dimsF: {}, types: ["OT100", "OT50NA"], q: { types: ["OT100", "OT50NA"] } },
      { name: "año, Áreas X o sin asignar", p: "year", dimsF: { AREA: { ids: [uid("AREA", "X")], none: true } }, q: { area: { ids: ["X"], none: true } } },
      { name: "año, base trabajadas", p: "year", dimsF: {}, base: "worked", q: { base: "worked" } },
      { name: "mes, base trabajadas, Turno A", p: "month", dimsF: { SHIFT: { ids: [uid("SHIFT", "A")], none: false } }, base: "worked", q: { base: "worked", shift: { ids: ["A"], none: false } } },
    ];

    const REF = "2026-09-01";
    const FIRST = "2026-03-01"; // primer mes con horas por tipo (P1)
    let failures = 0;
    for (const c of cases) {
      await withTenantContext(tenantId, (tx) =>
        tx.cfgTenantSetting.update({ where: { tenantId }, data: { overtimeBase: c.base ?? "scheduled" } })
      );
      const filters: OvertimeFilters = { p: c.p, dims: c.dimsF, types: c.types ?? [] };
      const base = c.base ?? "scheduled";
      const qBase = { ...c.q, base } as Omit<Q, "from" | "to">;
      const data = await loadOvertime(tenantId, filters, dims);
      const fails: string[] = [];
      if (data.status !== "ok") { console.log(`✗ ${c.name}: estado ${data.status}`); failures++; continue; }
      const per = buildPeriod(c.p, REF);
      const curFrom = per.start > FIRST ? per.start : FIRST;
      const cur = brute({ from: curFrom, to: per.end, ...qBase });

      near(data.kpis.rate.value, cur.base > 0 ? (cur.hours / cur.base) * 100 : null, "tasa", fails);
      near(data.kpis.hours.value, cur.hours, "horas extra", fails);
      near(data.kpis.people.value, cur.ot.size, "personas con horas extra", fails);
      near(data.kpis.people.covered, cur.covered.size, "personas con horas informadas", fails);
      near(data.kpis.people.pct, cur.covered.size > 0 ? (cur.ot.size / cur.covered.size) * 100 : null, "% de personas", fails);
      near(data.kpis.perPerson.value, cur.ot.size > 0 ? cur.hours / cur.ot.size : null, "horas por persona", fails);
      near(data.coverage.covered, cur.covered.size, "cobertura: informadas", fails);
      near(data.coverage.total, cur.all.size, "cobertura: total", fails);
      if (per.prevStart >= FIRST) {
        const prev = brute({ from: per.prevStart, to: per.prevEnd, ...qBase });
        near(data.kpis.rate.prev, prev.base > 0 ? (prev.hours / prev.base) * 100 : null, "tasa previa", fails);
        near(data.kpis.hours.prev, prev.hours, "horas previas", fails);
        near(data.kpis.people.prev, prev.ot.size, "personas previas", fails);
      } else near(data.kpis.rate.prev, null, "tasa previa (sin cobertura)", fails);

      // Por tipo: horas extra por un lado, no autorizadas aparte (y nunca mezcladas)
      for (const it of data.byType) near(it.hours, cur.byType.get(it.key) ?? 0, `tipo ${it.key}`, fails);
      for (const [k, v] of cur.byType) if (v > 0 && !data.byType.find((i) => i.key === k)) fails.push(`tipo ${k}: falta en el motor`);
      for (const it of data.unauthorized.items) near(it.hours, cur.naByType.get(it.key) ?? 0, `no autorizada ${it.key}`, fails);
      near(data.unauthorized.hours, cur.naHours, "no autorizadas: total", fails);
      if (data.byType.some((i) => i.key === "OT50NA" || i.key === "HG" || i.key === "TRAINING")) fails.push("la lista por tipo mezcla categorías");

      // Evolución de 12 meses
      for (const pt of data.series) {
        const m = pt.month < FIRST ? null : brute({ from: pt.month, to: monthEndOf(pt.month.slice(0, 7)), ...qBase });
        near(pt.rate, m && m.base > 0 ? (m.hours / m.base) * 100 : null, `serie ${pt.month}`, fails);
      }
      // Por dimensión
      for (const dim of data.dimensions) {
        const g = brute({ from: curFrom, to: per.end, ...qBase, groupBy: dim.code as "AREA" | "SHIFT" });
        const seen = new Set<string>();
        for (const it of dim.items) {
          const code = it.key === "none" ? "none" : [...ids.units].find(([, v]) => String(v) === it.key)![0].split(":")[1]!;
          seen.add(code);
          const gg = g.groups.get(code);
          near(it.base, gg?.base ?? 0, `${dim.code}/${code}: base`, fails);
          near(it.hours, gg?.hours ?? 0, `${dim.code}/${code}: horas`, fails);
          near(it.people, gg?.people.size ?? 0, `${dim.code}/${code}: personas`, fails);
          near(it.rate, gg && gg.base > 0 ? (gg.hours / gg.base) * 100 : null, `${dim.code}/${code}: tasa`, fails);
        }
        for (const [code, gg] of g.groups) if ((gg.base > 0 || gg.hours > 0) && !seen.has(code)) fails.push(`${dim.code}/${code}: falta en el motor`);
      }

      // Detalle (drill-down): debe sumar lo mismo que el resumen
      const asked = { page: 1, q: "" } as const;
      const all = { all: true } as const;
      const dHo = await loadDetail(tenantId, filters, dims, "horas", [], asked, all);
      if (dHo.status !== "ok" || dHo.kind !== "hours") fails.push("detalle horas: " + dHo.status);
      else {
        near(dHo.totalHours, data.kpis.hours.value, "detalle horas: total", fails);
        near(dHo.rows.reduce((a, r) => a + r.hours, 0), data.kpis.hours.value, "detalle horas: suma de filas", fails);
      }
      const dPe = await loadDetail(tenantId, filters, dims, "personas", [], asked, all);
      if (dPe.status !== "ok" || dPe.kind !== "people") fails.push("detalle personas: " + dPe.status);
      else {
        near(dPe.total, data.kpis.people.value, "detalle personas: total", fails);
        near(dPe.totalHours, data.kpis.hours.value, "detalle personas: horas", fails);
        near(dPe.rows.reduce((a, r) => a + r.hours, 0), data.kpis.hours.value, "detalle personas: suma de filas", fails);
        near(dPe.rows.reduce((a, r) => a + r.byType.reduce((x, t) => x + t.hours, 0), 0), data.kpis.hours.value, "detalle personas: desglose por tipo", fails);
        for (let i = 1; i < dPe.rows.length; i++) if (dPe.rows[i]!.hours > dPe.rows[i - 1]!.hours + 1e-9) { fails.push("detalle personas: no está ordenado por horas de mayor a menor"); break; }
      }
      for (const it of [...data.byType, ...data.unauthorized.items]) {
        const x = await loadDetail(tenantId, filters, dims, "tipo", [it.key], asked, all);
        if (x.status !== "ok") { fails.push(`detalle tipo ${it.key}: ${x.status}`); continue; }
        near(x.totalHours, it.hours, `detalle tipo ${it.key}: horas`, fails);
      }
      for (const dim of data.dimensions) {
        for (const it of dim.items) {
          const x = await loadDetail(tenantId, filters, dims, "dim", [dim.slug, it.key], asked, all);
          if (x.status !== "ok") { fails.push(`detalle ${dim.code}/${it.key}: ${x.status}`); continue; }
          near(x.totalHours, it.hours, `detalle ${dim.code}/${it.key}: horas`, fails);
        }
      }
      for (const bad of ["REGULAR", "inventado"]) {
        const x = await loadDetail(tenantId, filters, dims, "tipo", [bad], asked);
        if (x.status !== "notfound") fails.push(`detalle tipo ${bad}: debería ser notfound`);
      }

      if (fails.length) {
        failures++;
        console.log(`✗ ${c.name}\n   - ${fails.join("\n   - ")}`);
      } else {
        console.log(`✓ ${c.name}: tasa ${data.kpis.rate.value?.toFixed(3) ?? "-"} % · ${data.kpis.hours.value} h · ${data.kpis.people.value}/${data.kpis.people.covered} personas · no aut. ${data.unauthorized.hours} h`);
      }
    }

    // Estados: sin horas por tipo (solo cabeceras) -> vacío
    await withTenantContext(tenantId, async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM att_time_daily_entries WHERE tenant_id = '${tenantId}'::uuid`);
    }, { timeout: 120_000 });
    const empty = await loadOvertime(tenantId, { p: "month", dims: {}, types: [] }, dims);
    if (empty.status === "empty") console.log("✓ cabeceras sin horas por tipo: estado vacío");
    else { console.log("✗ cabeceras sin horas por tipo: debería ser vacío"); failures++; }

    console.log(failures === 0 ? "\nTODOS LOS CASOS COINCIDEN" : `\n${failures} CASO(S) CON DIFERENCIAS`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await withTenantContext(tenantId, async (tx) => {
      for (const t of ["att_time_daily_entries", "att_time_daily", "cfg_tenant_time_entry_types", "hr_people_history", "hr_people_org_assignments", "hr_people", "hr_shift_schedules", "hr_org_units", "dsh_dimensions", "cfg_tenant_org_unit_types"]) {
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
