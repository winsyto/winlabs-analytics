/**
 * Verificación del motor de ausentismo contra una implementación independiente (día por día, en JS).
 * Crea un tenant temporal con casos de borde, compara y lo borra. Uso (desde apps/cliente):
 *   npx tsx --env-file=.env.local scripts/verify-absenteeism-engine.ts
 */
import { prisma, applyDefaultOrgConfig, applyDefaultTenantSettings } from "@wla/db";
import { withTenantContext } from "@wla/auth";
import { loadTypeReport } from "../app/(dashboard)/absenteeism/reportes/_data/by-type";
import { loadDateReport } from "../app/(dashboard)/absenteeism/reportes/_data/by-date";
import { loadDetail } from "../app/(dashboard)/absenteeism/_data/detail-queries";
import { loadAbsenteeism } from "../app/(dashboard)/absenteeism/_data/queries";
import type { AbsenteeismFilters } from "../app/(dashboard)/absenteeism/_data/filters";
import { buildPeriod } from "../app/(dashboard)/_dashboard-kit/period";
import type { Dimension } from "../app/(dashboard)/_dashboard-kit/dimensions";
import type { DimensionFilter } from "../app/(dashboard)/_dashboard-kit/dimension-filters";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const addDay = (x: Date, n: number) => new Date(x.getTime() + n * 86400000);
const monthStartOf = (x: Date) => `${iso(x).slice(0, 7)}-01`;

// ── Fixtures (definidos acá; el cálculo independiente lee SOLO esto, no la base) ─────────────────────────────
interface Assign { type: "AREA" | "SHIFT"; unit: string; from: string; to: string | null }
interface Person { code: string; hire: string; term: string | null; assigns: Assign[] }
interface Ev { person: string; type: string; start: string; end: string; days: number | null; hours: number | null; status?: string }

const SHIFTS = { A: { week: "1111100", dh: 8 }, B: { week: "1111110", dh: 6 } } as Record<string, { week: string; dh: number }>;
const DEFAULT = { week: "1111100", dh: 8 };
const TYPES: Record<string, { cls: string; counts: boolean }> = {
  ENFERMEDAD: { cls: "medical", counts: true },
  SIN_AVISO: { cls: "unjustified", counts: true },
  SUSPENSION: { cls: "suspension", counts: true },
  TRAMITE: { cls: "other", counts: true },
  ACCIDENTE: { cls: "accident", counts: true },
  VACACIONES: { cls: "vacation", counts: false },
  EXAMEN: { cls: "legal_leave", counts: false },
};

const people: Person[] = [
  { code: "P1", hire: "2025-01-01", term: null, assigns: [{ type: "AREA", unit: "X", from: "2025-01-01", to: null }, { type: "SHIFT", unit: "A", from: "2025-01-01", to: null }] },
  { code: "P2", hire: "2025-06-01", term: null, assigns: [
    { type: "AREA", unit: "X", from: "2025-06-01", to: "2026-09-09" }, { type: "AREA", unit: "Y", from: "2026-09-10", to: null },
    { type: "SHIFT", unit: "A", from: "2025-06-01", to: "2026-08-15" }, { type: "SHIFT", unit: "B", from: "2026-08-16", to: null }] },
  { code: "P3", hire: "2024-01-01", term: "2026-08-20", assigns: [{ type: "AREA", unit: "Y", from: "2024-01-01", to: null }, { type: "SHIFT", unit: "B", from: "2024-01-01", to: null }] },
  { code: "P4", hire: "2025-01-01", term: null, assigns: [] },
  { code: "P5", hire: "2026-09-10", term: null, assigns: [{ type: "AREA", unit: "X", from: "2026-09-10", to: null }, { type: "SHIFT", unit: "A", from: "2026-09-10", to: null }] },
  { code: "P6", hire: "2025-01-01", term: null, assigns: [{ type: "AREA", unit: "Y", from: "2025-01-01", to: null }, { type: "SHIFT", unit: "A", from: "2025-01-01", to: null }] },
];
const events: Ev[] = [
  { person: "P1", type: "ENFERMEDAD", start: "2026-03-10", end: "2026-03-11", days: null, hours: null },
  { person: "P1", type: "ENFERMEDAD", start: "2026-08-27", end: "2026-09-04", days: null, hours: null },
  { person: "P1", type: "TRAMITE", start: "2026-09-14", end: "2026-09-16", days: 3, hours: 4 },
  { person: "P1", type: "VACACIONES", start: "2026-07-06", end: "2026-07-17", days: null, hours: null },
  { person: "P1", type: "ENFERMEDAD", start: "2026-05-04", end: "2026-05-04", days: null, hours: null, status: "cancelled" },
  { person: "P2", type: "SIN_AVISO", start: "2026-08-13", end: "2026-08-18", days: 6, hours: null },
  { person: "P2", type: "ENFERMEDAD", start: "2026-09-08", end: "2026-09-11", days: null, hours: null },
  { person: "P3", type: "ENFERMEDAD", start: "2026-08-17", end: "2026-08-25", days: null, hours: null },
  { person: "P4", type: "SUSPENSION", start: "2026-06-01", end: "2026-06-07", days: 5, hours: null },
  { person: "P4", type: "TRAMITE", start: "2026-07-01", end: "2026-07-01", days: null, hours: 2 },
  { person: "P5", type: "ENFERMEDAD", start: "2026-09-21", end: "2026-09-22", days: null, hours: null },
  { person: "P6", type: "EXAMEN", start: "2026-09-02", end: "2026-09-02", days: null, hours: null },
  { person: "P6", type: "ACCIDENTE", start: "2026-02-02", end: "2026-02-27", days: null, hours: null },
];

// ── Cálculo independiente (día por día) ─────────────────────────────────────────────────────────────────────
const unitAt = (p: Person, type: string, day: string): string | null =>
  p.assigns.find((a) => a.type === type && a.from <= day && (a.to === null || a.to >= day))?.unit ?? null;
const sched = (unit: string | null) => (unit ? SHIFTS[unit]! : DEFAULT);
const isWork = (week: string, day: Date) => week[(day.getUTCDay() + 6) % 7] === "1";
const personOf = (c: string) => people.find((p) => p.code === c)!;

function wdEvent(e: Ev): number {
  const p = personOf(e.person);
  const s = sched(unitAt(p, "SHIFT", e.start));
  let n = 0;
  for (let x = d(e.start); iso(x) <= e.end; x = addDay(x, 1)) if (isWork(s.week, x)) n++;
  return n;
}

interface DimSel { ids: string[]; none: boolean }
interface Q {
  from: string; to: string; // YYYY-MM-DD (inclusive)
  area?: DimSel; shift?: DimSel; classes?: string[]; types?: string[];
  groupBy?: "AREA" | "SHIFT";
}
interface TCell { ev: Set<string>; h: number; d: number }
interface Res { cells: Map<string, Map<string, TCell>>; typeTot: Map<string, TCell>; byClass: Map<string, number>; byType: Map<string, number>; exclHours: number; exclDays: number; sched: number; hours: number; days: number; events: Set<string>; persons: Set<string>; exposed: Set<string>; groups: Map<string, { sched: number; hours: number; days: number; people: Set<string> }> }

function brute(q: Q): Res {
  const r: Res = { cells: new Map(), typeTot: new Map(), byClass: new Map(), byType: new Map(), exclHours: 0, exclDays: 0, sched: 0, hours: 0, days: 0, events: new Set(), persons: new Set(), exposed: new Set(), groups: new Map() };
  const pass = (sel: DimSel | undefined, unit: string | null) =>
    !sel || (unit === null ? sel.none : sel.ids.includes(unit));
  const grp = (k: string) => {
    if (!r.groups.has(k)) r.groups.set(k, { sched: 0, hours: 0, days: 0, people: new Set() });
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
      if (work) {
        r.sched += s.dh;
        r.exposed.add(p.code);
        if (g) { grp(g).sched += s.dh; grp(g).people.add(p.code); }
      }
      for (const e of events) {
        if (e.person !== p.code || e.status === "cancelled") continue;
        const t = TYPES[e.type]!;
        if (ds < e.start || ds > e.end || !work) continue;
        const wd = wdEvent(e);
        const f = e.days === null || wd === 0 ? 1 : e.days / wd;
        const perDay = e.hours === null ? s.dh : Math.min(e.hours, s.dh);
        const h = perDay * f;
        if (!t.counts) { r.exclHours += h; r.exclDays += h / s.dh; continue; }
        if (q.classes?.length && !q.classes.includes(t.cls)) continue;
        if (q.types?.length && !q.types.includes(e.type)) continue;
        const evKey = `${e.person}|${e.start}|${e.type}`;
        const gk = g ?? "none";
        const cellMap = r.cells.get(e.type) ?? new Map<string, TCell>();
        r.cells.set(e.type, cellMap);
        const cc = cellMap.get(gk) ?? { ev: new Set<string>(), h: 0, d: 0 };
        cellMap.set(gk, cc);
        cc.ev.add(evKey); cc.h += h; cc.d += h / s.dh;
        const tt = r.typeTot.get(e.type) ?? { ev: new Set<string>(), h: 0, d: 0 };
        r.typeTot.set(e.type, tt);
        tt.ev.add(evKey); tt.h += h; tt.d += h / s.dh;
        r.byClass.set(t.cls, (r.byClass.get(t.cls) ?? 0) + h);
        r.byType.set(e.type, (r.byType.get(e.type) ?? 0) + h);
        r.hours += h;
        r.days += h / s.dh;
        r.events.add(`${e.person}|${e.start}|${e.type}`);
        r.persons.add(p.code);
        if (g) { grp(g).hours += h; grp(g).days += h / s.dh; }
      }
    }
  }
  return r;
}

// ── Resumen por fecha y unidad (independiente) ──────────────────────────────────────────────────────────────
const COUNTING_COLS = ["unjustified", "unpaid", "medical", "accident", "suspension", "personal", "other"];
interface DateGroup { assigned: number; cls: Record<string, number> }
function bruteDateReport(from: string, to: string, groupBy: "AREA" | "SHIFT" | null, areaSel?: DimSel): Map<string, DateGroup> {
  const out = new Map<string, DateGroup>();
  const g = (k: string) => {
    if (!out.has(k)) out.set(k, { assigned: 0, cls: {} });
    return out.get(k)!;
  };
  const single = from === to;
  for (const p of people) {
    for (let day = d(from); iso(day) <= to; day = addDay(day, 1)) {
      const ds = iso(day);
      if (ds < p.hire || (p.term !== null && ds >= p.term)) continue;
      const area = unitAt(p, "AREA", ds);
      const shift = unitAt(p, "SHIFT", ds);
      if (areaSel && !(area === null ? areaSel.none : areaSel.ids.includes(area))) continue;
      const sc = sched(shift);
      if (!isWork(sc.week, day)) continue;
      const key = groupBy === null ? "total" : ((groupBy === "AREA" ? area : shift) ?? "none");
      g(key).assigned += 1;
      const hits = events
        .filter((e) => e.person === p.code && e.status !== "cancelled" && ds >= e.start && ds <= e.end)
        .map((e) => {
          const wd = wdEvent(e);
          const f = e.days === null || wd === 0 ? 1 : e.days / wd;
          const h = (e.hours === null ? sc.dh : Math.min(e.hours, sc.dh)) * f;
          return { cls: TYPES[e.type]!.cls, counts: TYPES[e.type]!.counts, days: h / sc.dh, h };
        })
        .filter((x) => x.h > 0);
      const used = single ? hits.sort((a, b) => Number(b.counts) - Number(a.counts) || b.h - a.h).slice(0, 1) : hits;
      for (const x of used) g(key).cls[x.cls] = (g(key).cls[x.cls] ?? 0) + x.days;
    }
  }
  return out;
}

// ── Ejecución ───────────────────────────────────────────────────────────────────────────────────────────────
const near = (a: number | null, b: number | null, label: string, fails: string[]) => {
  if (a === null || b === null) {
    if (a !== b) fails.push(`${label}: ${a} vs ${b}`);
    return;
  }
  if (Math.abs(a - b) > 1e-6) fails.push(`${label}: motor ${a} vs independiente ${b}`);
};

async function main() {
  const slug = "tmp-abs-verify";
  await prisma.tenant.deleteMany({ where: { slug } }).catch(() => undefined);
  const tenant = await prisma.tenant.create({ data: { slug, name: "TMP verify" } });
  const tenantId = tenant.id;
  const ids = { units: new Map<string, number>(), people: new Map<string, number>() };
  try {
    await withTenantContext(tenantId, async (tx) => {
      await applyDefaultOrgConfig(tx, tenantId);
      await applyDefaultTenantSettings(tx, tenantId);
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
      const typeIds = new Map<string, number>();
      for (const [code, t] of Object.entries(TYPES)) {
        const row = await tx.cfgAbsenteeismType.create({ data: { tenantId, code, name: code, class: t.cls, countsAsAbsence: t.counts, isClassified: true } });
        typeIds.set(code, row.id);
      }
      for (const e of events) {
        await tx.attAbsenteeismEvent.create({
          data: { tenantId, personId: ids.people.get(e.person)!, absenteeismTypeId: typeIds.get(e.type)!, startDate: d(e.start), endDate: d(e.end),
                  daysCount: e.days, hoursCount: e.hours, status: e.status ?? "closed" },
        });
      }
    });

    const dims: Dimension[] = [
      { code: "AREA", name: "Área", slug: "area" },
      { code: "SHIFT", name: "Turno", slug: "shift" },
    ];
    const uid = (type: string, c: string) => ids.units.get(`${type}:${c}`)!;
    const none = { ids: [] as number[], none: true };
    const cases: { name: string; p: AbsenteeismFilters["p"]; dimsF: AbsenteeismFilters["dims"]; classes?: string[]; types?: string[]; q: Partial<Q> }[] = [
      { name: "año, sin filtros", p: "year", dimsF: {}, q: {} },
      { name: "mes, sin filtros", p: "month", dimsF: {}, q: {} },
      { name: "12m, sin filtros", p: "12m", dimsF: {}, q: {} },
      { name: "año, Área X", p: "year", dimsF: { AREA: { ids: [uid("AREA", "X")], none: false } }, q: { area: { ids: ["X"], none: false } } },
      { name: "año, Área Y", p: "year", dimsF: { AREA: { ids: [uid("AREA", "Y")], none: false } }, q: { area: { ids: ["Y"], none: false } } },
      { name: "año, Área sin asignar", p: "year", dimsF: { AREA: none }, q: { area: { ids: [], none: true } } },
      { name: "año, Turno A", p: "year", dimsF: { SHIFT: { ids: [uid("SHIFT", "A")], none: false } }, q: { shift: { ids: ["A"], none: false } } },
      { name: "mes, Turno B + Área Y", p: "month", dimsF: { SHIFT: { ids: [uid("SHIFT", "B")], none: false }, AREA: { ids: [uid("AREA", "Y")], none: false } }, q: { shift: { ids: ["B"], none: false }, area: { ids: ["Y"], none: false } } },
      { name: "año, clase medical", p: "year", dimsF: {}, classes: ["medical"], q: { classes: ["medical"] } },
      { name: "año, tipo TRAMITE", p: "year", dimsF: {}, types: ["TRAMITE"], q: { types: ["TRAMITE"] } },
      { name: "año, Áreas X o sin asignar", p: "year", dimsF: { AREA: { ids: [uid("AREA", "X")], none: true } }, q: { area: { ids: ["X"], none: true } } },
    ];

    const REF = "2026-09-01";
    const FIRST = "2026-02-01"; // primer mes con eventos (P6, accidente)
    let failures = 0;
    for (const c of cases) {
      const filters: AbsenteeismFilters = { p: c.p, dims: c.dimsF, classes: c.classes ?? [], types: c.types ?? [] };
      const data = await loadAbsenteeism(tenantId, filters, dims);
      const fails: string[] = [];
      if (data.status !== "ok") { console.log(`✗ ${c.name}: estado ${data.status}`); failures++; continue; }
      const per = buildPeriod(c.p, REF);
      const curFrom = per.start > FIRST ? per.start : FIRST;
      const cur = brute({ from: curFrom, to: per.end, ...c.q });
      near(data.kpis.rate.value, cur.sched > 0 ? (cur.hours / cur.sched) * 100 : null, "tasa", fails);
      near(data.kpis.absence.cur.hours, cur.hours, "horas", fails);
      near(data.kpis.absence.cur.days, cur.days, "días", fails);
      near(data.kpis.events.value, cur.events.size, "eventos", fails);
      near(data.kpis.people.value, cur.persons.size, "personas afectadas", fails);
      near(data.kpis.people.exposed, cur.exposed.size, "personas expuestas", fails);
      if (per.prevStart >= FIRST) {
        const prev = brute({ from: per.prevStart, to: per.prevEnd, ...c.q });
        near(data.kpis.rate.prev, prev.sched > 0 ? (prev.hours / prev.sched) * 100 : null, "tasa previa", fails);
        near(data.kpis.events.prev, prev.events.size, "eventos previos", fails);
        near(data.kpis.people.prev, prev.persons.size, "personas previas", fails);
      } else near(data.kpis.rate.prev, null, "tasa previa (sin cobertura)", fails);

      // Detalle (drill-down): debe sumar lo mismo que el resumen
      const asked = { page: 1, q: "" } as const;
      const all = { all: true } as const;
      const dEv = await loadDetail(tenantId, filters, dims, "eventos", [], asked, all);
      if (dEv.status !== "ok") fails.push("detalle eventos: " + dEv.status);
      else {
        near(dEv.total, data.kpis.events.value, "detalle eventos: total", fails);
        near(dEv.totals.hours, data.kpis.absence.cur.hours, "detalle eventos: horas", fails);
        near(dEv.rows.reduce((a, r) => a + ("hours" in r ? r.hours : 0), 0), data.kpis.absence.cur.hours, "detalle eventos: suma de filas", fails);
      }
      const dPe = await loadDetail(tenantId, filters, dims, "personas", [], asked, all);
      if (dPe.status !== "ok") fails.push("detalle personas: " + dPe.status);
      else {
        near(dPe.total, data.kpis.people.value, "detalle personas: total", fails);
        near(dPe.totals.hours, data.kpis.absence.cur.hours, "detalle personas: horas", fails);
      }
      for (const it of data.byClass) {
        const x = await loadDetail(tenantId, filters, dims, "clase", [it.key], asked, all);
        if (x.status !== "ok") { fails.push(`detalle clase ${it.key}: ${x.status}`); continue; }
        near(x.totals.hours, it.hours, `detalle clase ${it.key}: horas`, fails);
        near(x.total, it.events, `detalle clase ${it.key}: eventos`, fails);
      }
      for (const it of data.byType) {
        const x = await loadDetail(tenantId, filters, dims, "tipo", [it.key], asked, all);
        if (x.status !== "ok") { fails.push(`detalle tipo ${it.key}: ${x.status}`); continue; }
        near(x.totals.hours, it.hours, `detalle tipo ${it.key}: horas`, fails);
      }
      for (const dim of data.dimensions) {
        for (const it of dim.items) {
          const x = await loadDetail(tenantId, filters, dims, "dim", [dim.slug, it.key], asked, all);
          if (x.status !== "ok") { fails.push(`detalle ${dim.code}/${it.key}: ${x.status}`); continue; }
          near(x.totals.hours, it.hours, `detalle ${dim.code}/${it.key}: horas`, fails);
        }
      }
      const bad = await loadDetail(tenantId, filters, dims, "clase", ["inventada"], asked);
      if (bad.status !== "notfound") fails.push("detalle: clase inválida debería ser notfound");

      // Por clase / por tipo / fuera de la tasa
      for (const it of data.byClass) near(it.hours, cur.byClass.get(it.key) ?? 0, `clase ${it.key}`, fails);
      for (const it of data.byType) near(it.hours, cur.byType.get(it.key) ?? 0, `tipo ${it.key}`, fails);
      for (const [k, v] of cur.byClass) if (v > 0 && !data.byClass.find((i) => i.key === k)) fails.push(`clase ${k}: falta en el motor`);
      near(data.excluded.total.hours, cur.exclHours, "fuera de la tasa (horas)", fails);
      near(data.excluded.total.days, cur.exclDays, "fuera de la tasa (días)", fails);

      // Evolución de 12 meses
      for (const pt of data.series) {
        const mEnd = iso(addDay(d(`${pt.month.slice(0, 7)}-01`).getUTCMonth() === 11 ? d(`${Number(pt.month.slice(0, 4)) + 1}-01-01`) : d(`${pt.month.slice(0, 4)}-${String(Number(pt.month.slice(5, 7)) + 1).padStart(2, "0")}-01`), -1));
        const m = pt.month < FIRST ? null : brute({ from: pt.month, to: mEnd, ...c.q });
        near(pt.rate, m && m.sched > 0 ? (m.hours / m.sched) * 100 : null, `serie ${pt.month}`, fails);
      }
      // Por dimensión
      for (const dim of data.dimensions) {
        const g = brute({ from: curFrom, to: per.end, ...c.q, groupBy: dim.code as "AREA" | "SHIFT" });
        const seen = new Set<string>();
        for (const it of dim.items) {
          const code = it.key === "none" ? "none" : [...ids.units].find(([, v]) => String(v) === it.key)![0].split(":")[1]!;
          seen.add(code);
          const gg = g.groups.get(code);
          near(it.rate, gg && gg.sched > 0 ? (gg.hours / gg.sched) * 100 : null, `${dim.code}/${code} tasa`, fails);
          near(it.hours, gg?.hours ?? 0, `${dim.code}/${code} horas`, fails);
          near(it.people, gg?.people.size ?? 0, `${dim.code}/${code} personas`, fails);
        }
        for (const [code, gg] of g.groups) if ((gg.sched > 0 || gg.hours > 0) && !seen.has(code)) fails.push(`${dim.code}/${code}: falta en el motor`);
      }
      if (fails.length) { failures++; console.log(`✗ ${c.name}\n   - ${fails.slice(0, 8).join("\n   - ")}`); }
      else console.log(`✓ ${c.name}: tasa ${data.kpis.rate.value?.toFixed(3)} % · ${data.kpis.absence.cur.hours.toFixed(1)} h · ${data.kpis.events.value} eventos · ${data.kpis.people.value}/${data.kpis.people.exposed} personas`);
    }
    // Resumen por fecha y unidad
    const dateCases: { name: string; from: string; to: string; groupBy: "AREA" | "SHIFT" | null; area?: DimSel; areaF?: DimensionFilter }[] = [
      { name: "fecha 16/09 por área", from: "2026-09-16", to: "2026-09-16", groupBy: "AREA" },
      { name: "fecha 10/09 por área (cambio de área de P2)", from: "2026-09-10", to: "2026-09-10", groupBy: "AREA" },
      { name: "fecha 08/07 por turno (vacaciones)", from: "2026-07-08", to: "2026-07-08", groupBy: "SHIFT" },
      { name: "fecha 18/08 total (cambio de turno, sábado excluido)", from: "2026-08-18", to: "2026-08-18", groupBy: null },
      { name: "rango 10/08–18/09 por área", from: "2026-08-10", to: "2026-09-18", groupBy: "AREA" },
      { name: "rango 01/06–30/09 por turno", from: "2026-06-01", to: "2026-09-30", groupBy: "SHIFT" },
      { name: "rango por área, filtro Área X", from: "2026-08-10", to: "2026-09-18", groupBy: "AREA", area: { ids: ["X"], none: false }, areaF: { ids: [uid("AREA", "X")], none: false } },
    ];
    for (const c of dateCases) {
      const fails: string[] = [];
      const params = { from: c.from, to: c.to, groupBy: c.groupBy, dims: (c.areaF ? { AREA: c.areaF } : {}) as Record<string, DimensionFilter> };
      const rep = await loadDateReport(tenantId, dims, params);
      if (rep.status !== "ok") { failures++; console.log(`✗ ${c.name}: ${rep.status}`); continue; }
      const exp = bruteDateReport(c.from, c.to, c.groupBy, c.area);
      const nameToKey = (label: string, key: string) => (c.groupBy === null ? "total" : key === "none" ? "none" : [...ids.units].find(([, v]) => String(v) === key)![0].split(":")[1]!);
      const seen = new Set<string>();
      for (const r of rep.rows) {
        const code = nameToKey(r.label, r.key);
        seen.add(code);
        const e = exp.get(code) ?? { assigned: 0, cls: {} };
        near(r.assigned, e.assigned, `${code} dotación`, fails);
        near(r.dayOff, e.cls.day_off ?? 0, `${code} franco`, fails);
        near(r.vacation, e.cls.vacation ?? 0, `${code} vacaciones`, fails);
        near(r.legalLeave, e.cls.legal_leave ?? 0, `${code} lic. ley`, fails);
        near(r.unjustified, e.cls.unjustified ?? 0, `${code} sin aviso`, fails);
        near(r.unpaid, e.cls.unpaid ?? 0, `${code} sin goce`, fails);
        near(r.medical, e.cls.medical ?? 0, `${code} enfermedad`, fails);
        near(r.accident, e.cls.accident ?? 0, `${code} accidente`, fails);
        near(r.suspension, e.cls.suspension ?? 0, `${code} suspensión`, fails);
        near(r.other, (e.cls.personal ?? 0) + (e.cls.other ?? 0), `${code} otras`, fails);
        const absent = COUNTING_COLS.reduce((a, k) => a + (e.cls[k] ?? 0), 0);
        near(r.absent, absent, `${code} total ausentes`, fails);
        near(r.pct, e.assigned > 0 ? (absent / e.assigned) * 100 : null, `${code} %`, fails);
      }
      for (const [code, e] of exp) if ((e.assigned > 0 || Object.keys(e.cls).length) && !seen.has(code)) fails.push(`${code}: falta en el reporte`);
      if (fails.length) { failures++; console.log(`✗ ${c.name}` + String.fromCharCode(10) + "   - " + fails.slice(0, 8).join(String.fromCharCode(10) + "   - ")); }
      else console.log(`✓ ${c.name}: dotación ${rep.total.assigned} · ausentes ${rep.total.absent.toFixed(2)} · ${rep.rows.length} fila(s)`);
    }
    // Cuadro por tipo y unidad
    const typeCases: { name: string; base: (typeof cases)[number]; groupBy: "AREA" | "SHIFT" | null }[] = [
      { name: "año por área", base: cases[0]!, groupBy: "AREA" },
      { name: "mes por turno", base: cases[1]!, groupBy: "SHIFT" },
      { name: "12m total", base: cases[2]!, groupBy: null },
      { name: "año, Área X, por turno", base: cases[3]!, groupBy: "SHIFT" },
      { name: "año, clase medical, por área", base: cases[8]!, groupBy: "AREA" },
      { name: "año, tipo TRAMITE, por área", base: cases[9]!, groupBy: "AREA" },
    ];
    for (const c of typeCases) {
      const fails: string[] = [];
      const filters: AbsenteeismFilters = { p: c.base.p, dims: c.base.dimsF, classes: c.base.classes ?? [], types: c.base.types ?? [] };
      const rep = await loadTypeReport(tenantId, dims, { filters, groupBy: c.groupBy, measure: "events", showAll: false });
      if (rep.status !== "ok") { failures++; console.log(`✗ ${c.name}: ${rep.status}`); continue; }
      const per = buildPeriod(c.base.p, REF);
      const exp = brute({ from: per.start > FIRST ? per.start : FIRST, to: per.end, ...c.base.q, groupBy: c.groupBy ?? undefined });
      const codeOfKey = (key: string) => (c.groupBy === null || key === "none" ? "none" : [...ids.units].find(([, v]) => String(v) === key)![0].split(":")[1]!);
      for (const row of rep.rows) {
        const t = exp.typeTot.get(row.code);
        near(row.total.events, t?.ev.size ?? 0, `${row.code} total eventos`, fails);
        near(row.total.hours, t?.h ?? 0, `${row.code} total horas`, fails);
        near(row.total.days, t?.d ?? 0, `${row.code} total días`, fails);
        for (const col of rep.columns) {
          const cell = exp.cells.get(row.code)?.get(codeOfKey(col.key));
          const got = row.cells[col.key];
          near(got?.events ?? 0, cell?.ev.size ?? 0, `${row.code}/${col.label} eventos`, fails);
          near(got?.hours ?? 0, cell?.h ?? 0, `${row.code}/${col.label} horas`, fails);
        }
      }
      for (const [type, tt] of exp.typeTot) if (tt.ev.size > 0 && !rep.rows.find((r) => r.code === type)) fails.push(`${type}: falta la fila`);
      for (const col of rep.columns) {
        const g = c.groupBy === null ? undefined : exp.groups.get(codeOfKey(col.key));
        near(col.people, c.groupBy === null ? exp.exposed.size : (g?.people.size ?? 0), `${col.label} dotación`, fails);
      }
      near(rep.people, exp.exposed.size, "dotación total", fails);
      near(rep.totals.all.hours, exp.hours, "total horas", fails);
      near(rep.totals.all.events, exp.events.size, "total eventos", fails);
      if (fails.length) { failures++; console.log(`✗ cuadro ${c.name}` + String.fromCharCode(10) + "   - " + fails.slice(0, 8).join(String.fromCharCode(10) + "   - ")); }
      else console.log(`✓ cuadro ${c.name}: ${rep.rows.length} tipo(s) · ${rep.columns.length} columna(s) · ${rep.totals.all.events} eventos · dotación ${rep.people}`);
    }
    console.log(failures === 0 ? "\nTODOS LOS CASOS COINCIDEN" : `\n${failures} caso(s) con diferencias`);
  } finally {
    await withTenantContext(tenantId, async (tx) => {
      for (const t of ["att_absenteeism_events", "hr_people_history", "hr_people_org_assignments", "hr_people", "hr_shift_schedules", "hr_org_units", "dsh_dimensions", "cfg_tenant_org_unit_types", "cfg_absenteeism_types"]) {
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
