/**
 * Datos demo de People para desarrollo (NUNCA en producción).
 * ~120 personas con altas/bajas en 24 meses, 3 tipos de OU, contratos y géneros mezclados.
 * Determinístico (RNG con semilla) e idempotente (upsert por employee_code).
 */
import type { Prisma } from "@prisma/client";
import { rebuildPeopleSnapshots } from "../snapshots/people-snapshots";

type Tx = Prisma.TransactionClient;

type OuDef = { code: string; name: string; w: number };

const OU_DEFS: Record<"COMPANY" | "AREA" | "LOCATION" | "POSITION" | "CONTRACT", readonly OuDef[]> = {
  COMPANY: [
    { code: "CIA-SA", name: "Acme S.A.", w: 70 },
    { code: "CIA-SERV", name: "Acme Servicios S.R.L.", w: 30 },
  ],
  CONTRACT: [
    { code: "indefinido", name: "Indefinido", w: 70 },
    { code: "plazo_fijo", name: "Plazo fijo", w: 15 },
    { code: "temporal", name: "Temporal", w: 10 },
    { code: "contractor", name: "Contratista", w: 5 },
  ],
  AREA: [
    { code: "AREA-OPS", name: "Operaciones", w: 30 },
    { code: "AREA-VTA", name: "Ventas", w: 25 },
    { code: "AREA-TEC", name: "Tecnología", w: 20 },
    { code: "AREA-LOG", name: "Logística", w: 10 },
    { code: "AREA-FIN", name: "Finanzas", w: 9 },
    { code: "AREA-RRHH", name: "Recursos Humanos", w: 6 },
  ],
  LOCATION: [
    { code: "LOC-CABA", name: "Casa Central (CABA)", w: 55 },
    { code: "LOC-COR", name: "Córdoba", w: 28 },
    { code: "LOC-ROS", name: "Rosario", w: 17 },
  ],
  POSITION: [
    { code: "POS-OPE", name: "Operario/a", w: 22 },
    { code: "POS-ANA", name: "Analista", w: 22 },
    { code: "POS-EJV", name: "Ejecutivo/a de Cuentas", w: 14 },
    { code: "POS-DEV", name: "Desarrollador/a", w: 14 },
    { code: "POS-SUP", name: "Supervisor/a", w: 10 },
    { code: "POS-ADM", name: "Administrativo/a", w: 10 },
    { code: "POS-GER", name: "Gerente", w: 8 },
  ],
};

const FIRST = ["Lucía", "Martín", "Sofía", "Mateo", "Valentina", "Santiago", "Camila", "Joaquín", "Julieta", "Nicolás", "Agustina", "Tomás", "Florencia", "Lautaro", "Micaela", "Facundo", "Carolina", "Ignacio", "Paula", "Gonzalo", "Romina", "Federico", "Daniela", "Ezequiel", "Natalia", "Sebastián", "Mariana", "Diego", "Rocío", "Maximiliano"];
const LAST = ["González", "Rodríguez", "Fernández", "López", "Martínez", "García", "Pérez", "Sánchez", "Romero", "Díaz", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina", "Herrera", "Suárez", "Aguirre", "Giménez", "Gutiérrez", "Castro", "Ortiz"];

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

export async function seedDemoPeople(tx: Tx, tenantId: string): Promise<void> {
  const rnd = mulberry32(20260901);
  const pick = <T extends { w: number }>(items: readonly T[]): T => {
    const total = items.reduce((s, i) => s + i.w, 0);
    let r = rnd() * total;
    for (const i of items) {
      r -= i.w;
      if (r <= 0) return i;
    }
    return items[items.length - 1]!;
  };
  const between = (a: Date, b: Date) =>
    new Date(a.getTime() + rnd() * (b.getTime() - a.getTime()));

  const now = new Date();
  const monthStart = utc(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const windowEnd = utc(now.getUTCFullYear(), now.getUTCMonth(), 0); // último día del mes cerrado
  const windowStart = utc(now.getUTCFullYear(), now.getUTCMonth() - 24, 1);

  // 1. Org units
  const unitIds: Record<string, Record<string, number>> = {};
  for (const [type, defs] of Object.entries(OU_DEFS)) {
    unitIds[type] = {};
    for (const d of defs) {
      const ou = await tx.hrOrgUnit.upsert({
        where: {
          uq_hr_org_units_tenant_type_code: { tenantId, orgUnitTypeCode: type, code: d.code },
        },
        update: { name: d.name, isActive: true },
        create: { tenantId, orgUnitTypeCode: type, code: d.code, name: d.name, level: 0 },
      });
      unitIds[type]![d.code] = ou.id;
    }
  }

  // 2. Personas: 55 previas a la ventana, 62 dentro, 3 en el mes en curso
  type Plan = { hire: Date };
  const plans: Plan[] = [];
  for (let i = 0; i < 55; i++) plans.push({ hire: between(utc(2015, 0, 1), new Date(windowStart.getTime() - 86400000)) });
  for (let i = 0; i < 62; i++) plans.push({ hire: between(windowStart, windowEnd) });
  for (let i = 0; i < 3; i++) plans.push({ hire: between(monthStart, new Date(Math.max(monthStart.getTime() + 86400000, now.getTime() - 86400000))) });

  const terminateIdx = new Set<number>();
  while (terminateIdx.size < 30) {
    const idx = Math.floor(rnd() * 117); // excluye las 3 altas del mes en curso
    terminateIdx.add(idx);
  }

  const contractDefs = [
    { v: "indefinido", w: 70 },
    { v: "plazo_fijo", w: 15 },
    { v: "temporal", w: 10 },
    { v: "contractor", w: 5 },
  ];
  const genderDefs = [
    { v: "F", w: 47 },
    { v: "M", w: 49 },
    { v: "X", w: 4 },
  ];

  const personIds: number[] = [];
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]!;
    const first = FIRST[Math.floor(rnd() * FIRST.length)]!;
    const last = LAST[Math.floor(rnd() * LAST.length)]!;
    const contract = pick(contractDefs).v;
    const gender = pick(genderDefs).v;
    const birth = between(utc(1965, 0, 1), utc(2002, 11, 31));

    let terminationDate: Date | null = null;
    let reasonCode: string | null = null;
    if (terminateIdx.has(i)) {
      const earliest = new Date(Math.max(plan.hire.getTime() + 60 * 86400000, windowStart.getTime()));
      if (earliest < windowEnd) {
        terminationDate = between(earliest, windowEnd);
        const temp = contract === "plazo_fijo" || contract === "temporal";
        const r = rnd();
        reasonCode = temp && r < 0.6 ? "END_OF_CONTRACT"
          : r < 0.45 ? "VOLUNTARY_RESIGNATION"
          : r < 0.6 ? "BETTER_OFFER"
          : r < 0.78 ? "DISMISSAL"
          : r < 0.86 ? "DISMISSAL_WITH_CAUSE"
          : r < 0.93 ? "MUTUAL_AGREEMENT"
          : "RETIREMENT";
      }
    }

    const code = `DEMO-${String(i + 1).padStart(4, "0")}`;
    const data = {
      fullName: `${first} ${last}`,
      firstName: first,
      lastName: last,
      email: `${first}.${last}.${i + 1}@demo.acme.com`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, ""),
      birthDate: birth,
      gender,
      hireDate: plan.hire,
      terminationDate,
      terminationReasonCode: reasonCode,
      status: terminationDate ? "inactive" : "active",
      contractType: contract,
      salaryBand: `B${1 + Math.floor(rnd() * 4)}`,
    };
    const person = await tx.hrPerson.upsert({
      where: { uq_hr_people_tenant_code: { tenantId, employeeCode: code } },
      update: data,
      create: { tenantId, employeeCode: code, ...data },
    });
    personIds.push(person.id);

    // Asignaciones con vigencia: se recrean completas para que el seed sea idempotente
    await tx.hrPeopleOrgAssignment.deleteMany({ where: { tenantId, personId: person.id } });
    const from = plan.hire;
    const to = terminationDate;
    const assign = (type: string, orgUnitId: number, validFrom: Date, validTo: Date | null) =>
      tx.hrPeopleOrgAssignment.create({
        data: { tenantId, personId: person.id, orgUnitId, orgUnitTypeCode: type, validFrom, validTo },
      });

    for (const type of ["COMPANY", "LOCATION", "POSITION"] as const) {
      await assign(type, unitIds[type]![pick(OU_DEFS[type]).code]!, from, to);
    }
    await assign("CONTRACT", unitIds.CONTRACT![contract]!, from, to);

    // Área: ~15% cambió de área una vez (genera historia real de unidades)
    const areaDef = pick(OU_DEFS.AREA);
    const horizonEnd = to ?? windowEnd;
    const canChange = horizonEnd.getTime() - from.getTime() > 400 * 86400000 && rnd() < 0.15;
    if (canChange) {
      const prevDef = pick(OU_DEFS.AREA.filter((d) => d.code !== areaDef.code));
      const changeAt = between(new Date(from.getTime() + 180 * 86400000), new Date(horizonEnd.getTime() - 60 * 86400000));
      await assign("AREA", unitIds.AREA![prevDef.code]!, from, new Date(changeAt.getTime() - 86400000));
      await assign("AREA", unitIds.AREA![areaDef.code]!, changeAt, to);
    } else {
      await assign("AREA", unitIds.AREA![areaDef.code]!, from, to);
    }
  }

  // 3. Snapshots: 24 meses cerrados
  await rebuildPeopleSnapshots(tx, tenantId, iso(windowStart), iso(utc(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth(), 1)));

  console.log(`  ✅ Demo people [acme]: ${personIds.length} personas, snapshots ${iso(windowStart)} → ${iso(windowEnd)}`);
}
