"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePayConceptAction } from "../_actions/payroll-concepts.actions";

interface Option {
  code: string;
  name: string;
}

interface ConceptRow {
  id: number;
  code: string;
  name: string;
  conceptType: string | null;
  referenceTotal: "gross" | "net" | null;
  isClassified: boolean;
  ownClassId: number | null;
  typeClassName: string | null;
  effectiveClassName: string | null;
  entries: number;
}

function Row({
  row,
  types,
  classes,
  canEdit,
}: {
  row: ConceptRow;
  types: Option[];
  classes: { id: number; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: row.name,
    conceptType: row.conceptType ?? "",
    referenceTotal: row.referenceTotal ?? "",
    classId: row.ownClassId ? String(row.ownClassId) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const isAccumulator = form.conceptType === "accumulators";
  const changed =
    form.name !== row.name ||
    form.conceptType !== (row.conceptType ?? "") ||
    form.referenceTotal !== (row.referenceTotal ?? "") ||
    form.classId !== (row.ownClassId ? String(row.ownClassId) : "");
  const canSave = canEdit && (changed || !row.isClassified) && form.name.trim() !== "" && form.conceptType !== "";
  const typeName = types.find((t) => t.code === row.conceptType)?.name ?? "—";

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updatePayConceptAction({
        id: row.id,
        name: form.name,
        conceptType: form.conceptType,
        referenceTotal: isAccumulator && form.referenceTotal ? (form.referenceTotal as "gross" | "net") : null,
        classId: !isAccumulator && form.classId ? Number(form.classId) : null,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <tr className={`border-b align-top ${row.isClassified ? "" : "bg-amber-50/50"}`}>
      <td className="px-4 py-2">
        <p className="font-mono text-xs text-muted-foreground">{row.code}</p>
        {!row.isClassified && (
          <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
            Sin clasificar
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        {canEdit ? (
          <input
            aria-label={`Nombre de ${row.code}`}
            value={form.name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
          />
        ) : (
          <span className="text-sm">{row.name}</span>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-2">
        {canEdit ? (
          <select
            aria-label={`Tipo de ${row.code}`}
            value={form.conceptType}
            onChange={(e) => setForm({ ...form, conceptType: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
          >
            {form.conceptType === "" && <option value="">Elegí un tipo…</option>}
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm">{typeName}</span>
        )}
      </td>
      <td className="px-4 py-2">
        {isAccumulator ? (
          canEdit ? (
            <select
              aria-label={`Total de referencia de ${row.code}`}
              value={form.referenceTotal}
              onChange={(e) => setForm({ ...form, referenceTotal: e.target.value as "" | "gross" | "net" })}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="">Ninguno</option>
              <option value="gross">Es el sueldo bruto</option>
              <option value="net">Es el sueldo neto</option>
            </select>
          ) : (
            <span className="text-sm">
              {row.referenceTotal === "gross" ? "Sueldo bruto" : row.referenceTotal === "net" ? "Sueldo neto" : "—"}
            </span>
          )
        ) : canEdit ? (
          <select
            aria-label={`Clase de ${row.code}`}
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="">{row.typeClassName ? `Según el tipo (${row.typeClassName})` : "Según el tipo (sin clase)"}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm">{row.effectiveClassName ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-2 text-right text-sm tabular-nums text-muted-foreground">
        {new Intl.NumberFormat("es-AR").format(row.entries)}
      </td>
      {canEdit && (
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            disabled={pending || !canSave}
            onClick={save}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
          >
            {row.isClassified ? "Guardar" : "Confirmar"}
          </button>
        </td>
      )}
    </tr>
  );
}

export function PayrollConceptsTable({
  rows,
  types,
  classes,
  canEdit,
}: {
  rows: ConceptRow[];
  types: Option[];
  classes: { id: number; name: string }[];
  canEdit: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
        Todavía no hay conceptos. Se crean al cargar el archivo de Liquidaciones.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Código</th>
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Tipo</th>
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Clase / total</th>
            <th scope="col" className="h-10 px-4 text-right font-medium text-muted-foreground">Registros</th>
            {canEdit && <th scope="col" className="h-10 px-4"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row
              key={`${r.id}-${r.name}-${r.conceptType}-${r.referenceTotal}-${r.ownClassId}-${r.isClassified}`}
              row={r}
              types={types}
              classes={classes}
              canEdit={canEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
