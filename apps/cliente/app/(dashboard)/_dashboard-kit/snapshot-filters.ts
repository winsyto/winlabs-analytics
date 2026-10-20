/**
 * Filtros por unidad organizativa para los dashboards que leen los cierres mensuales (hr_people_history) y los
 * eventos de personas (altas y bajas). Los usan Headcount y Rotación.
 *
 * Entre dimensiones AND; dentro de una dimensión OR (unidades elegidas y/o "Sin asignar").
 */
import { Prisma } from "@wla/db";
import type { DimensionFilter } from "./dimension-filters";

/** Selección de unidades por tipo de dimensión (clave = código del tipo). */
export interface DimensionSelection {
  dims: Record<string, DimensionFilter>;
}

/** Unidades del cierre (columna JSON de hr_people_history, alias h) como arreglo, aunque venga vacía o nula. */
export const SNAP_ARR = Prisma.raw(
  "CASE WHEN jsonb_typeof(h.org_assignments_snapshot) = 'array' THEN h.org_assignments_snapshot ELSE '[]'::jsonb END"
);

/** Une condiciones con OR y las envuelve para usarlas como `AND (...)`. */
const orGroup = (conds: Prisma.Sql[]): Prisma.Sql => Prisma.sql`AND (${Prisma.join(conds, " OR ")})`;

/**
 * Filtros sobre hr_people_history (alias h). "Sin asignar" = sin ninguna unidad de ese tipo en el cierre.
 * Usa las unidades del cierre.
 */
export function snapFilter(f: DimensionSelection): Prisma.Sql {
  const parts = Object.entries(f.dims).map(([type, sel]) => {
    const conds: Prisma.Sql[] = [];
    if (sel.ids.length) {
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${SNAP_ARR}) fe
        WHERE fe->>'orgUnitTypeCode' = ${type} AND (fe->>'orgUnitId')::int IN (${Prisma.join(sel.ids)}))`);
    }
    if (sel.none) {
      conds.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(${SNAP_ARR}) fe WHERE fe->>'orgUnitTypeCode' = ${type})`);
    }
    return conds.length ? orGroup(conds) : Prisma.empty;
  });
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

/**
 * Filtros para altas y bajas sobre hr_people (alias p): la unidad se evalúa vigente en la fecha del evento
 * (fecha de ingreso para altas, fecha de baja para bajas). "Sin asignar" = sin unidad de ese tipo vigente ese día.
 */
export function eventFilter(f: DimensionSelection, dateCol: "p.hire_date" | "p.termination_date"): Prisma.Sql {
  const col = Prisma.raw(dateCol);
  const parts = Object.entries(f.dims).map(([type, sel]) => {
    const conds: Prisma.Sql[] = [];
    if (sel.ids.length) {
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM hr_people_org_assignments fa
        WHERE fa.person_id = p.id
          AND fa.org_unit_type_code = ${type}
          AND fa.org_unit_id IN (${Prisma.join(sel.ids)})
          AND fa.valid_from <= ${col}
          AND (fa.valid_to IS NULL OR fa.valid_to >= ${col}))`);
    }
    if (sel.none) {
      conds.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM hr_people_org_assignments fa
        WHERE fa.person_id = p.id
          AND fa.org_unit_type_code = ${type}
          AND fa.valid_from <= ${col}
          AND (fa.valid_to IS NULL OR fa.valid_to >= ${col}))`);
    }
    return conds.length ? orGroup(conds) : Prisma.empty;
  });
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}
