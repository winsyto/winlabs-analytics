/**
 * Horas por tipo de ejemplo para generate-examples.ts: 6 meses (abr a sep-2026), determinístico.
 * Usa su propio generador de números para no alterar el resto de los archivos de ejemplo.
 *
 * Una fila por persona, día y tipo de hora (employee_code, date, time_entry_type, hours):
 *  - horas regulares (REGULAR, o NIGHT en algunas personas del turno operativo) según el turno;
 *  - horas extra en una parte de las personas: OT50 en días de semana, OT100 en domingos, y de a ratos
 *    OT50OC, OTNIGHT y OT50NA (no autorizada);
 *  - los días con una ausencia del archivo de Ausentismo no llevan horas.
 */
import { SHIFT_WEEK, type AbsencePerson, type AbsenceRow } from "./absenteeism-gen";

export const TIME_HEADERS = ["employee_code", "date", "time_entry_type", "hours"];

export type TimeRow = (string | number)[];

const DAILY_HOURS = { ADM: 8, OPE: 8, PT: 6 } as const;

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

/** Más horas extra en junio y en el cierre de septiembre, menos en julio (abril a septiembre) */
const SEASON = [1, 1, 1.2, 0.7, 1, 1.4];

export function generateTimeEntries(
  people: AbsencePerson[],
  absences: AbsenceRow[]
): { rows: TimeRow[]; stats: Record<string, number> } {
  const rnd = mulberry32(20261018);
  const rows: TimeRow[] = [];
  const stats: Record<string, number> = {};
  const count = (t: string, h: number) => (stats[t] = Math.round(((stats[t] ?? 0) + h) * 10) / 10);

  const absent = new Map<string, Set<string>>();
  for (const a of absences) {
    const set = absent.get(String(a[0])) ?? new Set<string>();
    for (let d = new Date(`${a[2]}T00:00:00Z`); d <= new Date(`${a[3]}T00:00:00Z`); d = addDays(d, 1)) set.add(iso(d));
    absent.set(String(a[0]), set);
  }

  const FROM = utc(2026, 3, 1);
  const TO = utc(2026, 8, 30);
  // Perfil de cada persona: quién hace horas extra y quién trabaja de noche
  const profile = new Map<string, { overtime: number; night: boolean; na: boolean }>();
  for (const p of people) {
    const ope = p.shift === "OPE";
    profile.set(p.code, {
      overtime: rnd() < (ope ? 0.7 : 0.35) ? (ope ? 0.45 : 0.3) : 0,
      night: ope && rnd() < 0.25,
      na: rnd() < 0.15,
    });
  }

  for (const p of people) {
    const prof = profile.get(p.code)!;
    const week = SHIFT_WEEK[p.shift];
    const dh = DAILY_HOURS[p.shift];
    const off = absent.get(p.code);
    const from = p.hire > FROM ? p.hire : FROM;
    const to = p.term && p.term < TO ? p.term : TO;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const day = iso(d);
      const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
      const works = week[dow] === "1";
      const season = SEASON[d.getUTCMonth() - 3] ?? 1;
      const add = (type: string, hours: number) => {
        rows.push([p.code, day, type, hours]);
        count(type, hours);
      };

      if (works && !off?.has(day)) {
        add(prof.night ? "NIGHT" : "REGULAR", dh);
        if (prof.overtime > 0 && rnd() < prof.overtime * season) {
          const hours = 1 + Math.floor(rnd() * 7) / 2; // 1 a 4 horas, de a media
          const x = rnd();
          if (x < 0.08) add("OT50NA", hours);
          else if (x < 0.16) add("OT50OC", hours);
          else if (x < 0.3 && prof.night) add("OTNIGHT", hours);
          else add(prof.na && x > 0.9 ? "OT50NA" : "OT50", hours);
        }
      } else if (!works && dow === 6 && !off?.has(day) && prof.overtime > 0 && rnd() < prof.overtime * 0.3 * season) {
        // Domingo trabajado: toda la jornada es hora extra al 100%
        add(rnd() < 0.1 ? "OT100OC" : "OT100", 4 + Math.floor(rnd() * 5));
      }
    }
  }
  return { rows, stats };
}
