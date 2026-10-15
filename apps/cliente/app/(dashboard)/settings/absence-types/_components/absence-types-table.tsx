"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAbsenceTypeAction } from "../_actions/absence-types.actions";

interface ClassOption {
  code: string;
  name: string;
}

interface Row {
  id: number;
  code: string;
  name: string;
  class: string;
  countsAsAbsence: boolean;
  isClassified: boolean;
  events: number;
}

function Row({ row, classes, canEdit }: { row: Row; classes: ClassOption[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: row.name, class: row.class, countsAsAbsence: row.countsAsAbsence });
  const [error, setError] = useState<string | null>(null);
  const changed = form.name !== row.name || form.class !== row.class || form.countsAsAbsence !== row.countsAsAbsence;
  const canSave = canEdit && (changed || !row.isClassified) && form.name.trim() !== "";
  const className = classes.find((c) => c.code === row.class)?.name ?? row.class;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateAbsenceTypeAction({ id: row.id, ...form });
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
            <label htmlFor={`class-${row.id}`} className="sr-only">
              Clase de {row.code}
            </label>
            <select
              id={`class-${row.id}`}
              value={form.class}
              onChange={(e) => setForm({ ...form, class: e.target.value })}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
            >
              {classes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-sm">{className}</span>
        )}
      </td>
      <td className="px-4 py-2 text-center">
        <button
          type="button"
          role="switch"
          aria-checked={form.countsAsAbsence}
          aria-label={`${row.code}: cuenta como ausentismo`}
          disabled={!canEdit}
          onClick={() => setForm({ ...form, countsAsAbsence: !form.countsAsAbsence })}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-60 ${
            form.countsAsAbsence ? "bg-primary" : "bg-input"
          } ${canEdit ? "cursor-pointer" : ""}`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              form.countsAsAbsence ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <span className="sr-only">{form.countsAsAbsence ? "Sí" : "No"}</span>
      </td>
      <td className="px-4 py-2 text-right text-sm tabular-nums text-muted-foreground">
        {new Intl.NumberFormat("es-AR").format(row.events)}
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

export function AbsenceTypesTable({ rows, classes, canEdit }: { rows: Row[]; classes: ClassOption[]; canEdit: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
        Todavía no hay tipos de ausencia. Se crean al cargar el archivo de Ausentismo.
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
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Clase</th>
            <th scope="col" className="h-10 px-4 text-center font-medium text-muted-foreground">Cuenta como ausentismo</th>
            <th scope="col" className="h-10 px-4 text-right font-medium text-muted-foreground">Eventos</th>
            {canEdit && <th scope="col" className="h-10 px-4"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row
              key={`${r.id}-${r.name}-${r.class}-${r.countsAsAbsence}-${r.isClassified}`}
              row={r}
              classes={classes}
              canEdit={canEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
