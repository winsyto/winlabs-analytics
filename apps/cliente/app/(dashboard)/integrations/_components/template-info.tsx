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
  file_time: {
    label: "Asistencia",
    exampleFile: "/examples/file_time.xlsx",
    columns: [
      { name: "employee_code",   required: true,  description: "Código único del empleado" },
      { name: "date",            required: true,  description: "Fecha del registro (YYYY-MM-DD)" },
      { name: "time_entry_type", required: true,  description: "Código del tipo de hora (ej: REGULAR, OT50, OT100). Si no existe se crea sin clasificar; un tipo existente no se modifica" },
      { name: "hours",           required: true,  description: "Horas de ese tipo en el día (0 a 24, decimal). Una fila por persona, día y tipo; volver a cargar reemplaza las horas de ese tipo" },
    ],
  },
  file_absenteeism: {
    label: "Ausentismo",
    exampleFile: "/examples/file_absenteeism.xlsx",
    columns: [
      { name: "employee_code",        required: true,  description: "Código único del empleado" },
      { name: "absenteeism_type_code", required: true,  description: "Código del tipo de ausencia. Si no existe se crea; un tipo existente no se modifica" },
      { name: "start_date",           required: true,  description: "Fecha de inicio (YYYY-MM-DD)" },
      { name: "end_date",             required: true,  description: "Fecha de fin (YYYY-MM-DD)" },
      { name: "days_count",           required: false, description: "Días del evento. Si no viene se calcula con el turno de la persona" },
      { name: "hours_count",          required: false, description: "Horas de ausencia POR DÍA, solo si la ausencia es parcial (4 = medio día). Vacío = día completo" },
      { name: "justified",            required: false, description: "1 / true / si = justificado (default: 0)" },
      { name: "status",               required: false, description: "open | closed | cancelled (default: open). Los cancelados no cuentan" },
      { name: "notes",                required: false, description: "Observaciones" },
      { name: "absenteeism_type_name", required: false, description: "Nombre del tipo. Solo se usa al crear un tipo nuevo" },
      { name: "absenteeism_class",    required: false, description: "Clase del tipo nuevo: medical | accident | unpaid | unjustified | suspension | personal | other | vacation | legal_leave | day_off. Sin clase, el tipo queda sin clasificar" },
      { name: "counts_as_absence",    required: false, description: "1 / 0: si el tipo nuevo cuenta como ausentismo (default según su clase)" },
    ],
  },
  file_payroll: {
    label: "Liquidaciones",
    exampleFile: "/examples/file_payroll.xlsx",
    columns: [
      { name: "employee_code",       required: true,  description: "Código único del empleado" },
      { name: "period_code",         required: true,  description: "Mes de liquidación (AAAA-MM, ej: 2026-09). Se crea si no existe" },
      { name: "process_code",        required: true,  description: "Código del proceso de liquidación dentro del período (ej: MENS-2026-09, SAC-2026-06). Se crea si no existe" },
      { name: "process_description", required: false, description: "Descripción del proceso" },
      { name: "process_type",        required: false, description: "monthly | biweekly | weekly | sac | adjustments | provisions | final_settlement | vacation, o su nombre en español (default: monthly)" },
      { name: "process_start",       required: true,  description: "Fecha desde del proceso (YYYY-MM-DD)" },
      { name: "process_end",         required: true,  description: "Fecha hasta del proceso (YYYY-MM-DD)" },
      { name: "concept_code",        required: true,  description: "Código del concepto de liquidación. Si no existe se crea sin clasificar; un concepto existente no se modifica. Los acumuladores (total bruto, total neto) se cargan como conceptos" },
      { name: "concept_name",        required: true,  description: "Nombre del concepto. Solo se usa al crear un concepto nuevo" },
      { name: "amount",              required: true,  description: "Importe con el signo con el que viene de la liquidación (las retenciones, negativas). wlA no recalcula nada" },
      { name: "quantity",            required: false, description: "Cantidad asociada al concepto (horas, días, unidades; hasta 9999,99)" },
    ],
  },
};

export interface OrgTypeInfo {
  code: string;
  name: string;
  /** true = es dimensión de algún dashboard del tenant (columna obligatoria) */
  required: boolean;
}

interface TemplateInfoProps {
  templateCode: string;
  orgTypes: OrgTypeInfo[];
  terminationReasonCodes: string[];
}

function buildPeopleSpec(orgTypes: OrgTypeInfo[], reasons: string[]): TemplateSpec {
  const unitColumns: ColumnDef[] = orgTypes.flatMap((t) => {
    const key = t.code.toLowerCase();
    return [
      {
        name: `${key}_code`,
        required: t.required,
        description: `Código de ${t.name}${t.required ? " (dimensión del dashboard)" : ""}`,
      },
      { name: `${key}_name`, required: false, description: `Nombre de ${t.name} (si no se informa se usa el código)` },
    ];
  });
  return {
    label: "Personas",
    exampleFile: "/examples/file_people.xlsx",
    columns: [
      { name: "employee_code", required: true, description: "Código único del empleado" },
      { name: "full_name", required: true, description: "Nombre y apellido" },
      { name: "hire_date", required: true, description: "Fecha de ingreso (YYYY-MM-DD o DD/MM/YYYY)" },
      { name: "status", required: true, description: "active | inactive | on_leave" },
      {
        name: "termination_date",
        required: false,
        description: "Fecha de baja. Obligatoria si status = inactive; no puede ser anterior al ingreso",
      },
      {
        name: "termination_reason_code",
        required: false,
        description: `Motivo de baja. Obligatorio si status = inactive. Valores: ${reasons.join(" | ") || "ver catálogo"}`,
      },
      { name: "email", required: false, description: "Email corporativo" },
      { name: "birth_date", required: false, description: "Fecha de nacimiento" },
      { name: "gender", required: false, description: "M | F | X" },
      { name: "document_type", required: false, description: "DNI | CUIT | PASAPORTE" },
      { name: "document_number", required: false, description: "Número de documento" },
      { name: "manager_code", required: false, description: "employee_code del jefe directo" },
      ...unitColumns,
    ],
  };
}

function buildOrgHistorySpec(orgTypes: OrgTypeInfo[]): TemplateSpec {
  return {
    label: "Historial de unidades organizativas",
    exampleFile: "/examples/file_org_history.xlsx",
    columns: [
      { name: "employee_code", required: true, description: "Código del empleado (debe existir: cargar antes el archivo de Personas)" },
      {
        name: "org_unit_type",
        required: true,
        description: `Tipo de unidad. Habilitados: ${orgTypes.map((t) => t.code).join(" | ")}`,
      },
      { name: "org_unit_code", required: true, description: "Código de la unidad (se crea si no existe)" },
      { name: "org_unit_name", required: false, description: "Nombre de la unidad (si no se informa se usa el código)" },
      { name: "valid_from", required: true, description: "Inicio de vigencia (YYYY-MM-DD o DD/MM/YYYY)" },
      { name: "valid_to", required: false, description: "Fin de vigencia inclusive. Vacío = vigente; solo el último período puede estar abierto" },
    ],
  };
}

export function TemplateInfo({ templateCode, orgTypes, terminationReasonCodes }: TemplateInfoProps) {
  const spec =
    templateCode === "file_people"
      ? buildPeopleSpec(orgTypes, terminationReasonCodes)
      : templateCode === "file_org_history"
        ? buildOrgHistorySpec(orgTypes)
        : TEMPLATE_SPECS[templateCode];
  if (!spec) return null;

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Columnas del archivo de {spec.label.toLowerCase()}</h3>
        <a
          href={spec.exampleFile}
          download
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Descargar ejemplo (XLSX)
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

      {templateCode === "file_org_history" && (
        <p className="text-xs text-muted-foreground">
          Para cada persona y tipo, el historial del archivo reemplaza al existente. Los períodos no pueden solaparse.
        </p>
      )}
      {templateCode === "file_people" && (
        <p className="text-xs text-muted-foreground">
          Las columnas de unidades organizativas obligatorias dependen de las dimensiones configuradas para tu empresa.
          Cada fila con error se informa y no se carga; el resto del archivo sí.
        </p>
      )}
    </div>
  );
}
