"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTimeEntryTypeAction } from "../_actions/time-entry-types.actions";

interface CategoryOption {
  code: string;
  name: string;
}

interface Row {
  id: number;
  code: string;
  name: string;
  category: string;
  isClassified: boolean;
  entries: number;
}

function Row({ row, categories, canEdit }: { row: Row; categories: CategoryOption[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: row.name, category: row.category });
  const [error, setError] = useState<string | null>(null);
  const changed = form.name !== row.name || form.category !== row.category;
  const canSave = canEdit && (changed || !row.isClassified) && form.name.trim() !== "";
  const categoryName = categories.find((c) => c.code === row.category)?.name ?? row.category;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateTimeEntryTypeAction({ id: row.id, ...form });
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
          <>
            <label htmlFor={`cat-${row.id}`} className="sr-only">
              Categoría de {row.code}
            </label>
            <select
              id={`cat-${row.id}`}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
            >
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-sm">{categoryName}</span>
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

export function TimeEntryTypesTable({ rows, categories, canEdit }: { rows: Row[]; categories: CategoryOption[]; canEdit: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
        Todavía no hay tipos de hora. Se crean al cargar el archivo de Asistencia.
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
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Categoría</th>
            <th scope="col" className="h-10 px-4 text-right font-medium text-muted-foreground">Registros</th>
            {canEdit && <th scope="col" className="h-10 px-4"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row
              key={`${r.id}-${r.name}-${r.category}-${r.isClassified}`}
              row={r}
              categories={categories}
              canEdit={canEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
