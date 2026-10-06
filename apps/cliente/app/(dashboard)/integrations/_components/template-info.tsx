import { Download } from "lucide-react";

interface ColumnDef {
  name: string;
  required: boolean;
  description: string;
}

interface TemplateSpec {
  label: string;
  exampleFile: string;
  columns: ColumnDef[];
}

const TEMPLATE_SPECS: Record<string, TemplateSpec> = {
  file_people: {
    label: "Personas",
    exampleFile: "/examples/file_people.xlsx",
    columns: [
      { name: "employee_code", required: true,  description: "Código único del empleado" },
      { name: "full_name",     required: true,  description: "Nombre y apellido" },
      { name: "hire_date",     required: true,  description: "Fecha de ingreso (YYYY-MM-DD o DD/MM/YYYY)" },
      { name: "status",        required: true,  description: "active | inactive | terminated" },
      { name: "email",         required: false, description: "Email corporativo" },
      { name: "birth_date",    required: false, description: "Fecha de nacimiento" },
      { name: "gender",        required: false, description: "M | F | X" },
      { name: "document_type", required: false, description: "DNI | CUIT | PASAPORTE" },
      { name: "document_number", required: false, description: "Número de documento" },
      { name: "contract_type", required: false, description: "full_time | part_time | contractor" },
      { name: "area_code",     required: false, description: "Código del área" },
      { name: "area_name",     required: false, description: "Nombre del área" },
      { name: "position_code", required: false, description: "Código del puesto" },
      { name: "position_name", required: false, description: "Nombre del puesto" },
      { name: "location_code", required: false, description: "Código de la sede/ubicación" },
      { name: "location_name", required: false, description: "Nombre de la sede/ubicación" },
      { name: "manager_code",  required: false, description: "employee_code del jefe directo" },
    ],
  },
  file_time: {
    label: "Asistencia",
    exampleFile: "/examples/file_time.xlsx",
    columns: [
      { name: "employee_code",   required: true,  description: "Código único del empleado" },
      { name: "date",            required: true,  description: "Fecha del registro (YYYY-MM-DD)" },
      { name: "worked_hours",    required: true,  description: "Horas trabajadas (decimal, ej: 7.5)" },
      { name: "is_working_day",  required: false, description: "1 / true / si = día hábil (default: 1)" },
      { name: "scheduled_hours", required: false, description: "Horas teóricas planificadas" },
      { name: "has_absence",     required: false, description: "1 / true / si = tiene ausencia (default: 0)" },
    ],
  },
  file_absenteeism: {
    label: "Ausentismo",
    exampleFile: "/examples/file_absenteeism.xlsx",
    columns: [
      { name: "employee_code",        required: true,  description: "Código único del empleado" },
      { name: "absenteeism_type_code", required: true,  description: "Código del tipo de ausencia (se crea si no existe)" },
      { name: "start_date",           required: true,  description: "Fecha de inicio (YYYY-MM-DD)" },
      { name: "end_date",             required: true,  description: "Fecha de fin (YYYY-MM-DD)" },
      { name: "days_count",           required: false, description: "Días de duración (default: calculado)" },
      { name: "hours_count",          required: false, description: "Horas totales del evento" },
      { name: "justified",            required: false, description: "1 / true / si = justificado (default: 0)" },
      { name: "status",               required: false, description: "open | closed | cancelled (default: open)" },
      { name: "notes",                required: false, description: "Observaciones" },
    ],
  },
  file_payroll: {
    label: "Liquidaciones",
    exampleFile: "/examples/file_payroll.xlsx",
    columns: [
      { name: "employee_code",    required: true,  description: "Código único del empleado" },
      { name: "period_code",      required: true,  description: "Código del período (ej: 2026-09)" },
      { name: "period_start",     required: true,  description: "Inicio del período (YYYY-MM-DD)" },
      { name: "period_end",       required: true,  description: "Fin del período (YYYY-MM-DD)" },
      { name: "concept_code",     required: true,  description: "Código del concepto liquidatorio" },
      { name: "concept_name",     required: true,  description: "Nombre del concepto" },
      { name: "concept_category", required: true,  description: "basic_salary | bonus | overtime | absence_deduction | other" },
      { name: "amount",           required: true,  description: "Importe (positivo o negativo)" },
      { name: "hours",            required: false, description: "Horas asociadas (HHEE, ausencias)" },
    ],
  },
};

interface TemplateInfoProps {
  templateCode: string;
}

export function TemplateInfo({ templateCode }: TemplateInfoProps) {
  const spec = TEMPLATE_SPECS[templateCode];
  if (!spec) return null;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Columnas del archivo</h3>
        <a
          href={spec.exampleFile}
          download
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Descargar ejemplo CSV
        </a>
      </div>

      <div className="space-y-1">
        {spec.columns.map((col) => (
          <div key={col.name} className="flex items-start gap-2 text-xs py-1 border-b border-border/40 last:border-0">
            <code className="font-mono text-foreground shrink-0 w-44">{col.name}</code>
            <span className={`shrink-0 ${col.required ? "text-destructive" : "text-muted-foreground"}`}>
              {col.required ? "requerido" : "opcional"}
            </span>
            <span className="text-muted-foreground">{col.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
