import Link from "next/link";
import { auth } from "@/auth";
import { withTenantContext, canPerform } from "@wla/auth";
import { PAY_CLASS_SIDES, PAY_CONCEPT_TYPES } from "@wla/db";
import { ChevronRight } from "lucide-react";
import { getCurrentUserRole } from "../_lib/role";
import { PayrollConceptsTable } from "./_components/payroll-concepts-table";
import { PayrollClassesPanel } from "./_components/payroll-classes-panel";

export const dynamic = "force-dynamic";

async function load(tenantId: string) {
  return withTenantContext(tenantId, async (tx) => {
    const [concepts, classes, rules, usage] = await Promise.all([
      tx.payConcept.findMany({ where: { tenantId }, orderBy: [{ code: "asc" }] }),
      tx.payConceptClass.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } }),
      tx.payClassRule.findMany({ where: { tenantId } }),
      tx.payEntry.groupBy({ by: ["conceptId"], where: { tenantId }, _count: { _all: true } }),
    ]);
    const entries = new Map(usage.map((u) => [u.conceptId, u._count._all]));
    const classByType = new Map<string, number>();
    const classByConcept = new Map<number, number>();
    for (const r of rules) {
      if (r.conceptId !== null) classByConcept.set(r.conceptId, r.classId);
      else if (r.conceptType) classByType.set(r.conceptType, r.classId);
    }
    const classNames = new Map(classes.map((c) => [c.id, c.name]));

    const conceptRows = concepts
      .map((c) => {
        const ownClassId = classByConcept.get(c.id) ?? null;
        const typeClassId = c.conceptType ? (classByType.get(c.conceptType) ?? null) : null;
        const effective = ownClassId ?? typeClassId;
        return {
          id: c.id,
          code: c.code,
          name: c.name,
          conceptType: c.conceptType,
          referenceTotal: c.referenceTotal as "gross" | "net" | null,
          isClassified: c.isClassified,
          ownClassId,
          typeClassName: typeClassId ? (classNames.get(typeClassId) ?? null) : null,
          effectiveClassName: effective ? (classNames.get(effective) ?? null) : null,
          entries: entries.get(c.id) ?? 0,
        };
      })
      .sort((a, b) => Number(a.isClassified) - Number(b.isClassified) || a.code.localeCompare(b.code, "es", { numeric: true }));

    const classRows = classes.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      side: c.side as "earning" | "deduction",
      isActive: c.isActive,
      types: rules.filter((r) => r.classId === c.id && r.conceptType !== null).map((r) => r.conceptType as string),
      concepts: concepts.filter((x) => classByConcept.get(x.id) === c.id).map((x) => `${x.code} · ${x.name}`),
    }));

    return { conceptRows, classRows };
  });
}

export default async function PayrollConceptsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const role = await getCurrentUserRole(tenantId, session!.user.id);
  const canEdit = canPerform(role, "edit", "settings");
  const { conceptRows, classRows } = await load(tenantId);
  const pending = conceptRows.filter((r) => !r.isClassified).length;
  const showClasses = tab === "classes";

  const tabClass = (active: boolean) =>
    `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground transition-colors">
          Configuración
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-foreground">Conceptos de liquidación</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Conceptos de liquidación</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Cada concepto tiene un tipo estándar; las clases agrupan tipos (o conceptos puntuales) para el dashboard de
          Payroll. wlA usa los importes tal como vienen del archivo, sin recalcular la liquidación.
          {!canEdit && <span className="ml-2 text-xs">(solo lectura — necesitás rol admin para editar)</span>}
        </p>
      </div>

      <nav aria-label="Secciones" className="flex gap-1 border-b">
        <Link
          href="/settings/payroll-concepts"
          aria-current={showClasses ? undefined : "page"}
          className={tabClass(!showClasses)}
        >
          Conceptos
          <span className="ml-1.5 text-xs text-muted-foreground">{conceptRows.length}</span>
        </Link>
        <Link
          href="/settings/payroll-concepts?tab=classes"
          aria-current={showClasses ? "page" : undefined}
          className={tabClass(showClasses)}
        >
          Clases
          <span className="ml-1.5 text-xs text-muted-foreground">{classRows.length}</span>
        </Link>
      </nav>

      {showClasses ? (
        <PayrollClassesPanel
          classes={classRows}
          types={PAY_CONCEPT_TYPES.filter((t) => t.code !== "accumulators").map((t) => ({ code: t.code, name: t.name }))}
          sides={PAY_CLASS_SIDES.map((s) => ({ code: s.code, name: s.name }))}
          canEdit={canEdit}
        />
      ) : (
        <>
          {pending > 0 && (
            <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {pending === 1 ? "Hay 1 concepto sin clasificar" : `Hay ${pending} conceptos sin clasificar`}. Mientras
              tanto no se incluyen en ninguna clase del dashboard. Revisalos y guardá su tipo.
            </p>
          )}
          <PayrollConceptsTable
            rows={conceptRows}
            types={PAY_CONCEPT_TYPES.map((t) => ({ code: t.code, name: t.name }))}
            classes={classRows.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))}
            canEdit={canEdit}
          />
        </>
      )}
    </div>
  );
}
