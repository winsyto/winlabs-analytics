"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPayClassAction, updatePayClassAction } from "../_actions/payroll-concepts.actions";

interface Option {
  code: string;
  name: string;
}

interface ClassRow {
  id: number;
  code: string;
  name: string;
  side: "earning" | "deduction";
  isActive: boolean;
  types: string[];
  concepts: string[];
}

function ClassCard({ row, types, sides, canEdit }: { row: ClassRow; types: Option[]; sides: Option[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: row.name, side: row.side, isActive: row.isActive, types: row.types });
  const [error, setError] = useState<string | null>(null);
  const changed =
    form.name !== row.name ||
    form.side !== row.side ||
    form.isActive !== row.isActive ||
    [...form.types].sort().join() !== [...row.types].sort().join();

  function toggleType(code: string) {
    setForm({ ...form, types: form.types.includes(code) ? form.types.filter((t) => t !== code) : [...form.types, code] });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updatePayClassAction({ id: row.id, ...form });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const sideName = sides.find((s) => s.code === row.side)?.name ?? row.side;

  return (
    <li className={`rounded-xl border bg-card p-4 space-y-3 ${row.isActive ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <input
            aria-label={`Nombre de la clase ${row.name}`}
            value={form.name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="min-w-48 flex-1 rounded-md border bg-background px-2 py-1 text-sm font-medium"
          />
        ) : (
          <h3 className="flex-1 text-sm font-semibold">{row.name}</h3>
        )}
        {canEdit ? (
          <select
            aria-label={`Lado de la clase ${row.name}`}
            value={form.side}
            onChange={(e) => setForm({ ...form, side: e.target.value as ClassRow["side"] })}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            {sides.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{sideName}</span>
        )}
        {canEdit && (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Activa
          </label>
        )}
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Tipos de concepto que agrupa</legend>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => {
            const checked = form.types.includes(t.code);
            if (!canEdit && !checked) return null;
            return (
              <label
                key={t.code}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  checked ? "border-green-300 bg-green-50" : "bg-muted/40"
                } ${canEdit ? "cursor-pointer" : ""}`}
              >
                {canEdit && <input type="checkbox" checked={checked} onChange={() => toggleType(t.code)} />}
                {t.name}
              </label>
            );
          })}
          {!canEdit && form.types.length === 0 && <span className="text-xs text-muted-foreground">Ninguno</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Un tipo pertenece a una sola clase: si lo elegís acá, se saca de la que lo tenía.
        </p>
      </fieldset>

      {row.concepts.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Conceptos puntuales (ganan sobre el tipo)</p>
          <ul className="flex flex-wrap gap-1.5">
            {row.concepts.map((c) => (
              <li key={c} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pending || !changed || form.name.trim() === ""}
            onClick={save}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      )}
    </li>
  );
}

function NewClassForm({ sides }: { sides: Option[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [side, setSide] = useState<"earning" | "deduction">("earning");
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await createPayClassAction({ name, side });
      if (res.error) setError(res.error);
      else {
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-dashed p-4">
      <p className="mb-2 text-sm font-medium">Agregar una clase</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Nombre de la nueva clase"
          placeholder="Ej: Comisiones"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          className="min-w-48 flex-1 rounded-md border bg-background px-2 py-1 text-sm"
        />
        <select
          aria-label="Lado de la nueva clase"
          value={side}
          onChange={(e) => setSide(e.target.value as "earning" | "deduction")}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          {sides.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || name.trim() === ""}
          onClick={create}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function PayrollClassesPanel({
  classes,
  types,
  sides,
  canEdit,
}: {
  classes: ClassRow[];
  types: Option[];
  sides: Option[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        «Haber» suma a la masa salarial bruta; «Retención» se muestra aparte, con sus impuestos y descuentos. Para sacar
        un concepto puntual de la clase de su tipo, elegí otra clase en la pestaña Conceptos.
      </p>
      <ul className="space-y-3">
        {classes.map((c) => (
          <ClassCard
            key={`${c.id}-${c.name}-${c.side}-${c.isActive}-${c.types.join()}`}
            row={c}
            types={types}
            sides={sides}
            canEdit={canEdit}
          />
        ))}
      </ul>
      {canEdit && <NewClassForm sides={sides} />}
    </div>
  );
}
