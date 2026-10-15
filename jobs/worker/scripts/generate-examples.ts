/**
 * Genera los archivos de ejemplo de carga (apps/cliente/public/examples/*.xlsx).
 * Determinístico. Uso (desde jobs/worker): npx tsx scripts/generate-examples.ts
 *
 * Contenido: 48 personas (EMP001..EMP048) con altas repartidas en ~7 años, 10 bajas con motivo,
 * 5 dimensiones organizativas (empresa, sucursal, área, puesto, contrato) y un historial de
 * cambios de unidad para 9 personas. Asistencia, ausentismo y liquidaciones usan los mismos códigos.
 */
import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { ABSENCE_HEADERS, SHIFT_WEEK, generateAbsences, type ShiftCode } from "./absenteeism-gen";

const OUT_DIR = path.resolve(__dirname, "../../../apps/cliente/public/examples");

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
const rnd = mulberry32(20261013);
const pickW = <T extends { w: number }>(items: readonly T[]): T => {
  let r = rnd() * items.reduce((s, i) => s + i.w, 0);
  for (const i of items) {
    r -= i.w;
    if (r <= 0) return i;
  }
  return items[items.length - 1]!;
};
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;

// ── Catálogos de ejemplo ────────────────────────────────────────────────────
const COMPANIES = [
  { code: "ACME-SA", name: "Acme S.A.", w: 70 },
  { code: "ACME-SERV", name: "Acme Servicios S.R.L.", w: 30 },
];
const LOCATIONS = [
  { code: "BUE", name: "Buenos Aires", w: 55 },
  { code: "COR", name: "Córdoba", w: 28 },
  { code: "ROS", name: "Rosario", w: 17 },
];
const AREAS = [
  { code: "OPS", name: "Operaciones", w: 28 },
  { code: "VTA", name: "Ventas", w: 24 },
  { code: "IT", name: "Tecnología", w: 20 },
  { code: "LOG", name: "Logística", w: 10 },
  { code: "FIN", name: "Finanzas", w: 9 },
  { code: "RH", name: "Recursos Humanos", w: 9 },
];
const POSITIONS = [
  { code: "OPE", name: "Operario/a", w: 22 },
  { code: "ANA", name: "Analista", w: 24 },
  { code: "EJV", name: "Ejecutivo/a de Cuentas", w: 14 },
  { code: "DEV", name: "Desarrollador/a", w: 14 },
  { code: "SUP", name: "Supervisor/a", w: 12 },
  { code: "ADM", name: "Administrativo/a", w: 10 },
  { code: "GTE", name: "Gerente", w: 4 },
];
const CONTRACTS = [
  { code: "indefinido", name: "Indefinido", w: 70 },
  { code: "plazo_fijo", name: "Plazo fijo", w: 15 },
  { code: "temporal", name: "Temporal", w: 10 },
  { code: "contractor", name: "Contratista", w: 5 },
];
const REASONS = [
  { code: "VOLUNTARY_RESIGNATION", w: 35 },
  { code: "BETTER_OFFER", w: 15 },
  { code: "DISMISSAL", w: 20 },
  { code: "DISMISSAL_WITH_CAUSE", w: 8 },
  { code: "END_OF_CONTRACT", w: 14 },
  { code: "MUTUAL_AGREEMENT", w: 6 },
  { code: "RETIREMENT", w: 2 },
];
const FIRST = ["Lucía", "Martín", "Sofía", "Mateo", "Valentina", "Santiago", "Camila", "Joaquín", "Julieta", "Nicolás", "Agustina", "Tomás", "Florencia", "Lautaro", "Micaela", "Facundo", "Carolina", "Ignacio", "Paula", "Gonzalo", "Romina", "Federico", "Daniela", "Ezequiel"];
const LAST = ["González", "Rodríguez", "Fernández", "López", "Martínez", "García", "Pérez", "Sánchez", "Romero", "Díaz", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina", "Herrera", "Suárez"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const noAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "");

// ── Personas ────────────────────────────────────────────────────────────────
interface Person {
  code: string;
  name: string;
  hire: Date;
  term: Date | null;
  reason: string | null;
  email: string;
  birth: Date;
  gender: string;
  doc: string;
  manager: string | null;
  company: (typeof COMPANIES)[number];
  location: (typeof LOCATIONS)[number];
  area: (typeof AREAS)[number];
  position: (typeof POSITIONS)[number];
  contract: (typeof CONTRACTS)[number];
}

const SHIFTS: Record<ShiftCode, { code: string; name: string }> = {
  ADM: { code: "ADM", name: "Administrativo" },
  OPE: { code: "OPE", name: "Operativo 6x1" },
  PT: { code: "PT", name: "Part-time" },
};
/** Turno de ejemplo: operaciones y logística en el turno operativo; algunos part-time; el resto administrativo */
function shiftOf(p: Person): ShiftCode {
  if (p.area.code === "OPS" || p.area.code === "LOG") return "OPE";
  if (Number(p.code.slice(3)) % 8 === 0) return "PT";
  return "ADM";
}

const byCode = <T extends { code: string }>(arr: readonly T[], code: string) => arr.find((x) => x.code === code)!;
const ANCHOR = utc(2026, 9, 1); // 2026-10-01

const people: Person[] = [
  { code: "EMP001", name: "Juan Pérez", hire: utc(2020, 2, 15), term: null, reason: null, email: "juan.perez@empresa.com", birth: utc(1985, 6, 22), gender: "M", doc: "12345678", manager: null, company: COMPANIES[0]!, location: byCode(LOCATIONS, "BUE"), area: AREAS[0]!, position: byCode(POSITIONS, "GTE"), contract: CONTRACTS[0]! },
  { code: "EMP002", name: "María García", hire: utc(2021, 5, 1), term: null, reason: null, email: "maria.garcia@empresa.com", birth: utc(1990, 10, 10), gender: "F", doc: "23456789", manager: "EMP001", company: COMPANIES[0]!, location: byCode(LOCATIONS, "BUE"), area: byCode(AREAS, "IT"), position: byCode(POSITIONS, "DEV"), contract: CONTRACTS[0]! },
  { code: "EMP003", name: "Carlos López", hire: utc(2019, 0, 20), term: null, reason: null, email: "carlos.lopez@empresa.com", birth: utc(1988, 3, 5), gender: "M", doc: "34567890", manager: "EMP001", company: COMPANIES[0]!, location: byCode(LOCATIONS, "BUE"), area: byCode(AREAS, "RH"), position: byCode(POSITIONS, "ANA"), contract: CONTRACTS[0]! },
];

for (let n = 4; n <= 48; n++) {
  const monthsAgo = Math.floor(Math.pow(rnd(), 1.6) * 90);
  const hire = utc(2026, 8 - monthsAgo, 1 + Math.floor(rnd() * 28));
  const first = pick(FIRST);
  const last = pick(LAST);
  people.push({
    code: `EMP${String(n).padStart(3, "0")}`,
    name: `${first} ${last}`,
    hire,
    term: null,
    reason: null,
    email: `${noAccents(first)}.${noAccents(last)}.${n}@empresa.com`,
    birth: utc(1965 + Math.floor(rnd() * 38), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28)),
    gender: pickW([{ v: "F", w: 47 }, { v: "M", w: 49 }, { v: "X", w: 4 }]).v,
    doc: String(20000000 + n * 1013 + Math.floor(rnd() * 900)),
    manager: "EMP001",
    company: pickW(COMPANIES),
    location: pickW(LOCATIONS),
    area: pickW(AREAS),
    position: pickW(POSITIONS),
    contract: pickW(CONTRACTS),
  });
}

// 10 bajas: personas con al menos ~8 meses de antigüedad
const candidates = people.filter((p) => p.code >= "EMP004" && ANCHOR.getTime() - p.hire.getTime() > 240 * 86400000);
for (let i = 0; i < 10 && candidates.length > 0; i++) {
  const p = candidates.splice(Math.floor(rnd() * candidates.length), 1)[0]!;
  // Bajas concentradas en la ventana de 24 meses del dashboard (desde ene-2025)
  const e0 = addDays(p.hire, 120);
  const earliest = e0 > utc(2025, 0, 1) ? e0 : utc(2025, 0, 1);
  const latest = utc(2026, 8, 25);
  if (earliest >= latest) continue;
  p.term = new Date(earliest.getTime() + rnd() * (latest.getTime() - earliest.getTime()));
  const temp = p.contract.code === "plazo_fijo" || p.contract.code === "temporal";
  p.reason = temp && rnd() < 0.6 ? "END_OF_CONTRACT" : pickW(REASONS).code;
}

// ── Historial: cambios de unidad (9 personas activas ingresadas antes de dic-2024) ──
interface HistRow { emp: string; type: string; code: string; name: string; from: string; to: string | null }
const history: HistRow[] = [];
const movers = people.filter((p) => !p.term && p.code >= "EMP004" && p.hire < utc(2024, 11, 1)).slice(0, 9);
movers.forEach((p, idx) => {
  // Cambios dentro de la ventana de 24 meses del dashboard (ene-2025 a jun-2026)
  const change = addDays(utc(2025, 0, 1), Math.floor(rnd() * 545));
  const before = addDays(change, -1);
  const kind = idx % 3; // 0 = área, 1 = sucursal, 2 = contrato (plazo fijo → indefinido)
  if (kind === 0) {
    const prev = AREAS.find((a) => a.code !== p.area.code)!;
    history.push({ emp: p.code, type: "AREA", code: prev.code, name: prev.name, from: iso(p.hire), to: iso(before) });
    history.push({ emp: p.code, type: "AREA", code: p.area.code, name: p.area.name, from: iso(change), to: null });
  } else if (kind === 1) {
    const prev = LOCATIONS.find((l) => l.code !== p.location.code)!;
    history.push({ emp: p.code, type: "LOCATION", code: prev.code, name: prev.name, from: iso(p.hire), to: iso(before) });
    history.push({ emp: p.code, type: "LOCATION", code: p.location.code, name: p.location.name, from: iso(change), to: null });
  } else {
    p.contract = byCode(CONTRACTS, "indefinido");
    history.push({ emp: p.code, type: "CONTRACT", code: "plazo_fijo", name: "Plazo fijo", from: iso(p.hire), to: iso(before) });
    history.push({ emp: p.code, type: "CONTRACT", code: "indefinido", name: "Indefinido", from: iso(change), to: null });
  }
});

// ── Escritura ───────────────────────────────────────────────────────────────
async function write(file: string, headers: string[], rows: (string | number | null)[][], widths?: number[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Datos");
  ws.addRow(headers).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c, i) => (c.width = widths?.[i] ?? Math.max(12, headers[i]!.length + 2)));
  await wb.xlsx.writeFile(path.join(OUT_DIR, file));
  console.log(`✓ ${file}: ${rows.length} filas`);
}

async function main() {
  await write(
    "file_people.xlsx",
    ["employee_code", "full_name", "hire_date", "status", "termination_date", "termination_reason_code", "email", "birth_date", "gender", "document_type", "document_number", "manager_code",
     "company_code", "company_name", "location_code", "location_name", "area_code", "area_name", "position_code", "position_name", "contract_code", "contract_name", "shift_code", "shift_name"],
    people.map((p) => [
      p.code, p.name, iso(p.hire), p.term ? "inactive" : "active", p.term ? iso(p.term) : null, p.reason, p.email, iso(p.birth), p.gender, "DNI", p.doc, p.manager,
      p.company.code, p.company.name, p.location.code, p.location.name, p.area.code, p.area.name, p.position.code, p.position.name, p.contract.code, p.contract.name,
      SHIFTS[shiftOf(p)].code, SHIFTS[shiftOf(p)].name,
    ])
  );

  await write(
    "file_org_history.xlsx",
    ["employee_code", "org_unit_type", "org_unit_code", "org_unit_name", "valid_from", "valid_to"],
    history.map((h) => [h.emp, h.type, h.code, h.name, h.from, h.to])
  );

  const active = people.filter((p) => !p.term);
  const times: (string | number)[][] = [];
  for (const emp of ["EMP001", "EMP002", ...active.slice(3, 8).map((p) => p.code)]) {
    for (let d = 1; d <= 5; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      const absent = emp === "EMP001" && d === 3;
      const overtime = d === 2 && emp !== "EMP001";
      times.push([emp, date, 1, 8, absent ? 0 : overtime ? 9.5 : 8, absent ? 1 : 0]);
    }
  }
  await write("file_time.xlsx", ["employee_code", "date", "is_working_day", "scheduled_hours", "worked_hours", "has_absence"], times);

  const { rows: abs, stats } = generateAbsences(
    people.map((p) => ({ code: p.code, gender: p.gender, hire: p.hire, term: p.term, shift: shiftOf(p) }))
  );
  await write("file_absenteeism.xlsx", ABSENCE_HEADERS, abs);
  console.log("  eventos por tipo:", JSON.stringify(stats));
  console.log("  semana laboral de cada turno (cargar en Configuración > Turnos, 8 h por día; part-time 6 h):", JSON.stringify(SHIFT_WEEK));

  // Archivo con errores para probar validaciones y avisos (NO es público: se usa en pruebas locales)
  const errRows: (string | number | null)[][] = [
    ["EMP002", "ENFERMEDAD", "2026-09-21", "2026-09-22", 2, null, 1, "open", "Fila válida", null, null, null],
    ["EMP002", "ENFERMEDAD", "2026-09-29", "2026-09-25", null, null, 1, "open", "Fin anterior al inicio", null, null, null],
    ["EMP999", "ENFERMEDAD", "2026-09-21", "2026-09-21", null, null, 1, "open", "Persona inexistente", null, null, null],
    ["EMP998", "ENFERMEDAD", "2026-09-22", "2026-09-22", null, null, 1, "open", "Otra persona inexistente", null, null, null],
    ["EMP003", "NUEVO_MAL", "2026-08-03", "2026-08-03", null, null, 0, "open", "Clase inválida", "Tipo mal clasificado", "inventada", 1],
    ["EMP003", "ENFERMEDAD", "2026-08-10", "2026-08-10", 1, 30, 0, "open", "Horas por día > 24", null, null, null],
    ["EMP003", "ENFERMEDAD", "2026-08-11", "2026-08-11", null, null, 0, "pendiente", "Estado inválido", null, null, null],
    ["EMP003", "ENFERMEDAD", "2026-08-12", "2026-08-12", "abc", null, 0, "open", "Días inválidos", null, null, null],
    ["EMP003", "CURSO_EXTERNO", "2026-08-17", "2026-08-18", 2, null, 1, "closed", "Tipo nuevo clasificado desde el archivo", "Curso externo", "other", 0],
    ["EMP003", "GESTION_PERSONAL", "2026-08-19", "2026-08-19", 1, 4, 1, "closed", "Tipo nuevo SIN clasificar, ausencia parcial", null, null, null],
  ];
  const fixtures = path.resolve(__dirname, "fixtures");
  await fs.mkdir(fixtures, { recursive: true });
  const wbErr = new ExcelJS.Workbook();
  const wsErr = wbErr.addWorksheet("Datos");
  wsErr.addRow(ABSENCE_HEADERS).font = { bold: true };
  errRows.forEach((r) => wsErr.addRow(r));
  await wbErr.xlsx.writeFile(path.join(fixtures, "file_absenteeism_errors.xlsx"));
  console.log(`✓ fixtures/file_absenteeism_errors.xlsx: ${errRows.length} filas`);

  const pay: (string | number | null)[][] = [
    ["EMP001", "2026-09", "2026-09-01", "2026-09-30", "SUELDO_BASE", "Sueldo Básico", "basic_salary", 350000, null],
    ["EMP001", "2026-09", "2026-09-01", "2026-09-30", "HHEE", "Horas Extra", "overtime", 15000, 10],
    ["EMP002", "2026-09", "2026-09-01", "2026-09-30", "SUELDO_BASE", "Sueldo Básico", "basic_salary", 280000, null],
    ["EMP003", "2026-09", "2026-09-01", "2026-09-30", "SUELDO_BASE", "Sueldo Básico", "basic_salary", 260000, null],
    ["EMP003", "2026-09", "2026-09-01", "2026-09-30", "DESC_AUSENCIA", "Descuento por Ausencia", "absence_deduction", -5250, null],
  ];
  active.slice(3, 11).forEach((p, i) => {
    pay.push([p.code, "2026-09", "2026-09-01", "2026-09-30", "SUELDO_BASE", "Sueldo Básico", "basic_salary", 230000 + i * 15000, null]);
    if (i % 3 === 0) pay.push([p.code, "2026-09", "2026-09-01", "2026-09-30", "HHEE", "Horas Extra", "overtime", 9000 + i * 500, 6]);
  });
  await write("file_payroll.xlsx", ["employee_code", "period_code", "period_start", "period_end", "concept_code", "concept_name", "concept_category", "amount", "hours"], pay);

  console.log(`\nPersonas: ${people.length} (${people.filter((p) => p.term).length} con baja) · historial: ${history.length} filas`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
