/**
 * Genera archivos XLSX de ejemplo para cada template de integración de archivo.
 * Salida: ../../apps/cliente/public/examples/
 *
 * Correr: pnpm --filter @wla/integration-files generate
 */
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../apps/cliente/public/examples");

interface SheetSpec {
  filename: string;
  headers: string[];
  rows: (string | number | null)[][];
}

const SPECS: SheetSpec[] = [
  {
    filename: "file_people.xlsx",
    headers: [
      "employee_code", "full_name", "hire_date", "status",
      "email", "birth_date", "gender", "document_type", "document_number",
      "contract_type", "area_code", "area_name", "position_code", "position_name",
      "location_code", "location_name", "manager_code",
    ],
    rows: [
      ["EMP001", "Juan Pérez",    "2020-03-15", "active", "juan.perez@empresa.com",   "1985-07-22", "M", "DNI", "12345678", "full_time", "GER", "Gerencia",           "GTE",  "Gerente",         "BUE", "Buenos Aires", null],
      ["EMP002", "María García",  "2021-06-01", "active", "maria.garcia@empresa.com", "1990-11-10", "F", "DNI", "23456789", "full_time", "IT",  "Tecnología",         "DEV",  "Desarrollador",   "BUE", "Buenos Aires", "EMP001"],
      ["EMP003", "Carlos López",  "2019-01-20", "active", "carlos.lopez@empresa.com", "1988-04-05", "M", "DNI", "34567890", "part_time", "RH",  "Recursos Humanos",   "RRHH", "Analista RRHH",   "BUE", "Buenos Aires", "EMP001"],
    ],
  },
  {
    filename: "file_time.xlsx",
    headers: [
      "employee_code", "date", "is_working_day",
      "scheduled_hours", "worked_hours", "has_absence",
    ],
    rows: [
      ["EMP001", "2026-09-01", 1, 8,   8,   0],
      ["EMP001", "2026-09-02", 1, 8,   7.5, 0],
      ["EMP001", "2026-09-03", 1, 8,   0,   1],
      ["EMP002", "2026-09-01", 1, 8,   8,   0],
      ["EMP002", "2026-09-02", 1, 8,   8,   0],
      ["EMP002", "2026-09-03", 0, 0,   0,   0],
    ],
  },
  {
    filename: "file_absenteeism.xlsx",
    headers: [
      "employee_code", "absenteeism_type_code", "start_date", "end_date",
      "days_count", "hours_count", "justified", "status", "notes",
    ],
    rows: [
      ["EMP001", "ENFERMEDAD",  "2026-09-03", "2026-09-03", 1, 8,  1, "open",   "Certificado médico"],
      ["EMP003", "PERSONAL",    "2026-09-10", "2026-09-11", 2, 16, 0, "open",   null],
      ["EMP002", "VACACIONES",  "2026-09-15", "2026-09-19", 5, 40, 1, "closed", null],
    ],
  },
  {
    filename: "file_payroll.xlsx",
    headers: [
      "employee_code", "period_code", "period_start", "period_end",
      "concept_code", "concept_name", "concept_category", "amount", "hours",
    ],
    rows: [
      ["EMP001", "2026-09", "2026-09-01", "2026-09-30", "SUELDO_BASE",  "Sueldo Básico",          "basic_salary",      350000, null],
      ["EMP001", "2026-09", "2026-09-01", "2026-09-30", "HHEE",         "Horas Extra",            "overtime",           15000, 10],
      ["EMP002", "2026-09", "2026-09-01", "2026-09-30", "SUELDO_BASE",  "Sueldo Básico",          "basic_salary",      280000, null],
      ["EMP003", "2026-09", "2026-09-01", "2026-09-30", "SUELDO_BASE",  "Sueldo Básico",          "basic_salary",      210000, null],
      ["EMP003", "2026-09", "2026-09-01", "2026-09-30", "DESC_AUSENCIA","Descuento por Ausencia", "absence_deduction",  -5250, null],
    ],
  },
];

async function generateXlsx(spec: SheetSpec): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");

  // Header row — bold
  const headerRow = sheet.addRow(spec.headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // Data rows
  for (const row of spec.rows) {
    sheet.addRow(row);
  }

  // Auto-width columns
  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value != null ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = maxLen + 2;
  });

  const outPath = path.join(OUT_DIR, spec.filename);
  await workbook.xlsx.writeFile(outPath);
  console.log(`✓ ${spec.filename}`);
}

async function main() {
  const { default: fs } = await import("fs");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const spec of SPECS) {
    await generateXlsx(spec);
  }
  console.log("✓ Todos los ejemplos generados en apps/cliente/public/examples/");
}

main().catch((e) => { console.error(e); process.exit(1); });
