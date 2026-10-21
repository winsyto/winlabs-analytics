/**
 * Liquidaciones de ejemplo para generate-examples.ts: 12 meses (oct-2025 a sep-2026), determinístico.
 * Usa su propio generador de números para no alterar el resto de los archivos de ejemplo.
 *
 * Una fila por persona, proceso y concepto:
 *  - un proceso mensual por mes con sueldo básico, antigüedad, presentismo, horas extra (en parte de las personas),
 *    bonos trimestrales, aportes y ganancias (importes negativos), préstamos, contribuciones patronales y los
 *    acumuladores TOTAL_BRUTO y TOTAL_NETO;
 *  - un proceso de SAC en junio y diciembre;
 *  - procesos de ajustes sueltos en algunos meses.
 * Los importes salen tal como los informaría el sistema de origen: las retenciones vienen con signo negativo.
 */
export const PAYROLL_HEADERS = [
  "employee_code", "period_code", "process_code", "process_description", "process_type",
  "process_start", "process_end", "concept_code", "concept_name", "amount", "quantity",
];

export type PayrollExampleRow = (string | number | null)[];

export interface PayrollPerson {
  code: string;
  hire: Date;
  term: Date | null;
  positionCode: string;
}

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
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sueldo básico mensual de referencia por puesto (ARS) */
const BASE_SALARY: Record<string, number> = {
  OPE: 520000, ANA: 780000, EJV: 900000, DEV: 1300000, SUP: 1000000, ADM: 600000, GTE: 2400000,
};

export const CONCEPT_NAMES = {
  SUELDO_BASE: "Sueldo básico",
  ANTIGUEDAD: "Antigüedad",
  PRESENTISMO: "Presentismo",
  HHEE50: "Horas extra 50%",
  HHEE100: "Horas extra 100%",
  BONO_DESEMP: "Bono por desempeño",
  SAC: "SAC / aguinaldo",
  AJUSTE_RETRO: "Ajuste retroactivo",
  JUBILACION: "Jubilación",
  OBRA_SOCIAL: "Obra social",
  LEY_19032: "Ley 19032 (PAMI)",
  GANANCIAS: "Impuesto a las ganancias",
  PRESTAMO: "Cuota de préstamo",
  CONTRIB_PATRONAL: "Contribuciones patronales",
  TOTAL_BRUTO: "Total bruto",
  TOTAL_NETO: "Total neto",
} as const;

const MONTHS = 12;
const FIRST_MONTH = utc(2025, 9, 1); // octubre 2025

export function generatePayroll(people: PayrollPerson[]): { rows: PayrollExampleRow[]; stats: Record<string, number> } {
  const rnd = mulberry32(20261021);
  const rows: PayrollExampleRow[] = [];
  const stats: Record<string, number> = {};
  const add = (k: string, v: number) => (stats[k] = round2((stats[k] ?? 0) + v));

  // Perfil de cada persona: nivel salarial, horas extra, bono y préstamo
  const profile = new Map<string, { level: number; overtime: boolean; bonus: boolean; loan: boolean }>();
  people.forEach((p, i) =>
    profile.set(p.code, {
      level: 0.9 + rnd() * 0.25,
      overtime: rnd() < 0.3,
      bonus: rnd() < 0.25,
      loan: i % 9 === 0,
    })
  );

  for (let m = 0; m < MONTHS; m++) {
    const start = utc(FIRST_MONTH.getUTCFullYear(), FIRST_MONTH.getUTCMonth() + m, 1);
    const end = utc(start.getUTCFullYear(), start.getUTCMonth() + 1, 0);
    const period = iso(start).slice(0, 7);
    const days = end.getUTCDate();
    const calMonth = start.getUTCMonth(); // 0 = enero
    const raise = Math.pow(1.06, Math.floor(m / 3));
    const monthly = {
      code: `MENS-${period}`,
      description: `Liquidación mensual ${period}`,
      type: "monthly",
      from: iso(start),
      to: iso(end),
    };
    const sac = calMonth === 5 || calMonth === 11 ? { code: `SAC-${period}`, description: `SAC ${calMonth === 5 ? "primer" : "segundo"} semestre ${start.getUTCFullYear()}`, type: "sac", from: iso(start), to: iso(end) } : null;

    const push = (emp: string, proc: typeof monthly, concept: keyof typeof CONCEPT_NAMES, amount: number, quantity: number | null = null) => {
      rows.push([emp, period, proc.code, proc.description, proc.type, proc.from, proc.to, concept, CONCEPT_NAMES[concept], round2(amount), quantity]);
      add(`${proc.type}:${concept}`, amount);
    };

    /** Aportes, ganancias, contribuciones y acumuladores de una liquidación con el bruto dado */
    const closing = (emp: string, proc: typeof monthly, gross: number, withLoan: boolean) => {
      const jub = -gross * 0.11;
      const os = -gross * 0.03;
      const pami = -gross * 0.03;
      const tax = gross > 2000000 ? -(gross - 2000000) * 0.15 : 0;
      const loan = withLoan ? -40000 : 0;
      push(emp, proc, "JUBILACION", jub);
      push(emp, proc, "OBRA_SOCIAL", os);
      push(emp, proc, "LEY_19032", pami);
      if (tax !== 0) push(emp, proc, "GANANCIAS", tax);
      if (loan !== 0) push(emp, proc, "PRESTAMO", loan);
      push(emp, proc, "CONTRIB_PATRONAL", gross * 0.24);
      push(emp, proc, "TOTAL_BRUTO", gross);
      push(emp, proc, "TOTAL_NETO", gross + jub + os + pami + tax + loan);
    };

    for (const p of people) {
      if (p.hire > end || (p.term && p.term < start)) continue;
      const prof = profile.get(p.code)!;
      const from = p.hire > start ? p.hire : start;
      const to = p.term && p.term < end ? p.term : end;
      const frac = (Math.round((to.getTime() - from.getTime()) / 86400000) + 1) / days;
      const base = round2((BASE_SALARY[p.positionCode] ?? 700000) * prof.level * raise * frac);
      const years = Math.max(0, Math.floor((end.getTime() - p.hire.getTime()) / (365.25 * 86400000)));
      const seniority = round2(base * 0.01 * years);
      const attendance = round2((base + seniority) / 12);
      push(p.code, monthly, "SUELDO_BASE", base);
      if (seniority > 0) push(p.code, monthly, "ANTIGUEDAD", seniority);
      push(p.code, monthly, "PRESENTISMO", attendance);
      let gross = base + seniority + attendance;

      if (prof.overtime && frac === 1) {
        const hourly = (base + seniority) / 200;
        const h50 = 4 + Math.floor(rnd() * 13);
        const a50 = round2(h50 * hourly * 1.5);
        push(p.code, monthly, "HHEE50", a50, h50);
        gross += a50;
        if (rnd() < 0.5) {
          const h100 = 2 + Math.floor(rnd() * 7);
          const a100 = round2(h100 * hourly * 2);
          push(p.code, monthly, "HHEE100", a100, h100);
          gross += a100;
        }
      }
      if (prof.bonus && calMonth % 3 === 2) {
        const bonus = round2(base * 0.5);
        push(p.code, monthly, "BONO_DESEMP", bonus);
        gross += bonus;
      }
      closing(p.code, monthly, round2(gross), prof.loan);

      if (sac && frac === 1) {
        const amount = round2((base + seniority) * 0.5);
        push(p.code, sac, "SAC", amount);
        closing(p.code, sac, amount, false);
      }
    }

    // Ajustes sueltos en algunos meses: retroactivos de tres personas
    if (calMonth === 1 || calMonth === 4 || calMonth === 7) {
      const proc = { code: `AJUS-${period}`, description: `Ajuste retroactivo ${period}`, type: "adjustments", from: iso(start), to: iso(end) };
      const eligible = people.filter((p) => p.hire < start && (!p.term || p.term > end));
      const picked = new Set<string>();
      for (let k = 0; k < 3 && k < eligible.length; k++) {
        let p = eligible[Math.floor(rnd() * eligible.length)]!;
        while (picked.has(p.code)) p = eligible[Math.floor(rnd() * eligible.length)]!;
        picked.add(p.code);
        const amount = round2((BASE_SALARY[p.positionCode] ?? 700000) * (0.03 + rnd() * 0.04));
        push(p.code, proc, "AJUSTE_RETRO", amount);
        closing(p.code, proc, amount, false);
      }
    }
  }
  return { rows, stats };
}
