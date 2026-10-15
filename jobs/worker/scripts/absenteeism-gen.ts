/**
 * Eventos de ausencia de ejemplo para generate-examples.ts: 24 meses (oct-2024 a sep-2026), determinístico.
 * Usa su propio generador de números para no alterar el resto de los archivos de ejemplo.
 *
 * Semántica de los importes (igual que el archivo real):
 *  - days_count  = días del evento (días laborables del turno); vacío = lo calcula el dashboard.
 *  - hours_count = horas de ausencia POR DÍA en una ausencia parcial (4 = medio día); vacío = día completo.
 */

export type ShiftCode = "ADM" | "OPE" | "PT";

/** Semana laboral de cada turno de ejemplo, lunes a domingo (el horario se carga en Configuración > Turnos) */
export const SHIFT_WEEK: Record<ShiftCode, string> = { ADM: "1111100", OPE: "1111110", PT: "1111100" };

export interface AbsencePerson {
  code: string;
  gender: string;
  hire: Date;
  term: Date | null;
  shift: ShiftCode;
}

export type AbsenceRow = (string | number | null)[];

export const ABSENCE_HEADERS = [
  "employee_code", "absenteeism_type_code", "start_date", "end_date", "days_count", "hours_count",
  "justified", "status", "notes", "absenteeism_type_name", "absenteeism_class", "counts_as_absence",
];

interface TypeDef { code: string; name: string; cls: string; counts: boolean }

const T: Record<string, TypeDef> = {
  ENFERMEDAD: { code: "ENFERMEDAD", name: "Enfermedad", cls: "medical", counts: true },
  ENFERMEDAD_FAMILIAR: { code: "ENFERMEDAD_FAMILIAR", name: "Enfermedad de familiar", cls: "personal", counts: true },
  ACCIDENTE_TRABAJO: { code: "ACCIDENTE_TRABAJO", name: "Accidente de trabajo / ART", cls: "accident", counts: true },
  SIN_GOCE: { code: "SIN_GOCE", name: "Sin goce de haberes", cls: "unpaid", counts: true },
  SIN_AVISO: { code: "SIN_AVISO", name: "Ausencia sin aviso", cls: "unjustified", counts: true },
  SUSPENSION: { code: "SUSPENSION", name: "Suspensión", cls: "suspension", counts: true },
  MUDANZA: { code: "MUDANZA", name: "Mudanza", cls: "personal", counts: true },
  VACACIONES: { code: "VACACIONES", name: "Vacaciones", cls: "vacation", counts: false },
  MATERNIDAD: { code: "MATERNIDAD", name: "Licencia por maternidad", cls: "legal_leave", counts: false },
  PATERNIDAD: { code: "PATERNIDAD", name: "Licencia por paternidad", cls: "legal_leave", counts: false },
  MATRIMONIO: { code: "MATRIMONIO", name: "Licencia por matrimonio", cls: "legal_leave", counts: false },
  FALLECIMIENTO: { code: "FALLECIMIENTO", name: "Licencia por fallecimiento", cls: "legal_leave", counts: false },
  EXAMEN: { code: "EXAMEN", name: "Licencia por examen", cls: "legal_leave", counts: false },
  FRANCO_COMPENSATORIO: { code: "FRANCO_COMPENSATORIO", name: "Franco compensatorio", cls: "day_off", counts: false },
  // Tipo que no está en el catálogo y viaja sin clasificar: queda "sin clasificar" al cargarlo
  TRAMITE: { code: "TRAMITE", name: "", cls: "", counts: true },
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Estacionalidad de la enfermedad (invierno austral más alto), enero a diciembre */
const FLU = [0.8, 0.8, 1, 1.1, 1.3, 1.7, 1.9, 1.6, 1.2, 1, 0.9, 0.8];

/** Probabilidad de que una persona tenga un evento en un mes (2 intentos por mes) */
const TRIAL_P = 0.34;

const COUNTING: { t: string; w: number; seasonal?: boolean }[] = [
  { t: "ENFERMEDAD", w: 46, seasonal: true },
  { t: "ENFERMEDAD_FAMILIAR", w: 12 },
  { t: "SIN_AVISO", w: 10 },
  { t: "SIN_GOCE", w: 5 },
  { t: "ACCIDENTE_TRABAJO", w: 3 },
  { t: "SUSPENSION", w: 2 },
  { t: "MUDANZA", w: 2 },
  { t: "TRAMITE", w: 8 },
];

export function generateAbsences(people: AbsencePerson[]): { rows: AbsenceRow[]; stats: Record<string, number> } {
  const rnd = mulberry32(20261016);
  const rows: AbsenceRow[] = [];
  const stats: Record<string, number> = {};
  const busy = new Map<string, Set<string>>(); // persona -> días ocupados

  const isWork = (p: AbsencePerson, d: Date) => SHIFT_WEEK[p.shift][(d.getUTCDay() + 6) % 7] === "1";
  const bound = (p: AbsencePerson) => ({
    from: p.hire > utc(2024, 9, 1) ? p.hire : utc(2024, 9, 1),
    to: p.term ?? utc(2026, 8, 30),
  });

  /** Días laborables consecutivos (según el turno) desde `start`; devuelve el rango o null si choca o excede la persona */
  function span(p: AbsencePerson, start: Date, workDays: number, force = false): { end: Date; days: number } | null {
    const { from, to } = bound(p);
    if (start < from || start > to || !isWork(p, start)) return null;
    let d = start;
    let n = 1;
    while (n < workDays) {
      d = addDays(d, 1);
      if (isWork(p, d)) n++;
    }
    if (!force && d > to) return null;
    const used = busy.get(p.code) ?? new Set<string>();
    for (let x = start; x <= d; x = addDays(x, 1)) if (used.has(iso(x))) return null;
    return { end: d, days: n };
  }

  function add(
    p: AbsencePerson, typeCode: string, start: Date, workDays: number,
    opts: { mode?: "auto" | "none" | "days" | "partial"; notes?: string; justified?: number; status?: string; force?: boolean } = {}
  ): boolean {
    const r = span(p, start, workDays, opts.force);
    if (!r) return false;
    const used = busy.get(p.code) ?? new Set<string>();
    for (let x = start; x <= r.end; x = addDays(x, 1)) used.add(iso(x));
    busy.set(p.code, used);

    const def = T[typeCode]!;
    let mode = opts.mode ?? "auto";
    if (mode === "auto") {
      const x = rnd();
      const partialOk = r.days <= 3 && ["ENFERMEDAD", "ENFERMEDAD_FAMILIAR", "EXAMEN", "TRAMITE", "MUDANZA"].includes(typeCode);
      mode = x < 0.5 ? "none" : x < 0.8 || !partialOk ? "days" : "partial";
    }
    const days = mode === "none" ? null : r.days;
    const hours = mode === "partial" ? (rnd() < 0.5 ? 4 : 2) : null;
    const status = opts.status ?? (r.end <= utc(2026, 8, 30) ? "closed" : "open");
    rows.push([
      p.code, def.code, iso(start), iso(r.end), days, hours,
      opts.justified ?? (["ENFERMEDAD", "ENFERMEDAD_FAMILIAR", "ACCIDENTE_TRABAJO", "TRAMITE"].includes(typeCode) ? 1 : 0),
      status, opts.notes ?? "",
      def.cls ? def.name : null, def.cls || null, def.cls ? (def.counts ? 1 : 0) : null,
    ]);
    stats[typeCode] = (stats[typeCode] ?? 0) + 1;
    return true;
  }

  const pickW = <X extends { w: number }>(items: X[]) => {
    let r = rnd() * items.reduce((s, i) => s + i.w, 0);
    for (const i of items) {
      r -= i.w;
      if (r <= 0) return i;
    }
    return items[items.length - 1]!;
  };

  const byCode = new Map(people.map((p) => [p.code, p]));

  // Eventos fijos (coinciden con los archivos de asistencia de ejemplo)
  const emp1 = byCode.get("EMP001")!;
  const emp2 = byCode.get("EMP002")!;
  const emp3 = byCode.get("EMP003")!;
  add(emp1, "ENFERMEDAD", utc(2026, 8, 3), 1, { mode: "days", notes: "Certificado médico", justified: 1 });
  // Licencia por maternidad larga: cruza varios meses y sigue abierta
  add(emp2, "MATERNIDAD", utc(2026, 6, 20), 65, { mode: "none", force: true, notes: "Licencia por maternidad", justified: 1 });
  // Accidente de trabajo largo que cruza dos meses
  add(emp3, "ACCIDENTE_TRABAJO", utc(2026, 2, 16), 30, { mode: "days", notes: "ART", justified: 1 });

  for (const p of people) {
    const { from, to } = bound(p);
    // Eventos que cuentan como ausentismo, por mes
    for (let y = 2024, m = 9; y < 2026 || m <= 8; m++) {
      if (m > 11) { m = 0; y++; }
      if (y === 2026 && m > 8) break;
      const monthStart = utc(y, m, 1);
      const monthEnd = utc(y, m + 1, 0);
      if (monthEnd < from || monthStart > to) continue;
      for (let trial = 0; trial < 2; trial++) {
        if (rnd() > TRIAL_P) continue;
        const types = COUNTING.map((c) => ({ ...c, w: c.seasonal ? c.w * FLU[m]! : c.w }));
        const t = pickW(types).t;
        const dur = t === "ACCIDENTE_TRABAJO" ? 5 + Math.floor(rnd() * 12)
          : t === "ENFERMEDAD" ? pickW([{ n: 1, w: 45 }, { n: 2, w: 25 }, { n: 3, w: 15 }, { n: 4 + Math.floor(rnd() * 4), w: 15 }]).n
          : t === "SIN_GOCE" || t === "SUSPENSION" ? 1 + Math.floor(rnd() * 3)
          : t === "ENFERMEDAD_FAMILIAR" ? 1 + Math.floor(rnd() * 2)
          : 1;
        const day = 1 + Math.floor(rnd() * 27);
        add(p, t, utc(y, m, day), dur, {
          notes: t === "ENFERMEDAD" && rnd() < 0.7 ? "Certificado médico" : "",
        });
      }
      // Licencias y francos (no cuentan como ausentismo)
      const rare = rnd();
      if (rare < 0.02) add(p, "EXAMEN", utc(y, m, 1 + Math.floor(rnd() * 27)), 1 + Math.floor(rnd() * 2));
      else if (rare < 0.05) add(p, "FRANCO_COMPENSATORIO", utc(y, m, 1 + Math.floor(rnd() * 27)), 1);
      else if (rare < 0.056) add(p, "FALLECIMIENTO", utc(y, m, 1 + Math.floor(rnd() * 27)), 3);
      else if (rare < 0.062) add(p, "MATRIMONIO", utc(y, m, 1 + Math.floor(rnd() * 20)), 5);
      else if (rare < 0.068 && p.gender === "M") add(p, "PATERNIDAD", utc(y, m, 1 + Math.floor(rnd() * 20)), 2 + Math.floor(rnd() * 8));
    }
    // Vacaciones: una vez por año, más en enero, julio y diciembre
    for (const year of [2024, 2025, 2026]) {
      const month = pickW([{ m: 0, w: 30 }, { m: 6, w: 28 }, { m: 11, w: 18 }, { m: 2, w: 8 }, { m: 4, w: 8 }, { m: 9, w: 8 }]).m;
      if ((year === 2024 && month < 9) || (year === 2026 && month > 8)) continue;
      const start = utc(year, month, 1 + Math.floor(rnd() * 14));
      if (start < from || start > to) continue;
      add(p, "VACACIONES", start, 7 + Math.floor(rnd() * 8), { mode: rnd() < 0.5 ? "none" : "days", justified: 1 });
    }
  }

  // Un evento cancelado
  const cancelledIdx = rows.findIndex((r, i) => i > 40 && r[1] === "ENFERMEDAD");
  if (cancelledIdx >= 0) {
    rows[cancelledIdx]![7] = "cancelled";
    stats.CANCELLED = 1;
  }

  // Tasa aproximada de la muestra (días laborables ausentes que cuentan / días laborables programados)
  let sched = 0;
  for (const p of people) {
    const { from, to } = bound(p);
    for (let x = from; x <= to; x = addDays(x, 1)) if (isWork(p, x)) sched++;
  }
  let absent = 0;
  const shiftByCode = new Map(people.map((p) => [p.code, p]));
  for (const r of rows) {
    const t = Object.values(T).find((d) => d.code === r[1])!;
    if (!t.counts || r[7] === "cancelled") continue;
    const person = shiftByCode.get(String(r[0]))!;
    for (let x = new Date(`${r[2]}T00:00:00Z`); x <= new Date(`${r[3]}T00:00:00Z`); x = addDays(x, 1)) if (isWork(person, x)) absent++;
  }
  stats.RATE_PCT = Math.round((absent / sched) * 1000) / 10;

  rows.sort((a, b) => String(a[2]).localeCompare(String(b[2])) || String(a[0]).localeCompare(String(b[0])));
  return { rows, stats };
}
