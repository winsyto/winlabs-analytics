"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@wla/ui";
import {
  createAbsenceTypeDefaultAction,
  updateAbsenceTypeDefaultAction,
  type AbsenceTypeState,
} from "../_actions/absence-types.actions";

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
  isActive: boolean;
}

function Switch({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ClassSelect({
  id,
  value,
  classes,
  onChange,
}: {
  id: string;
  value: string;
  classes: ClassOption[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border bg-background px-2 py-1 text-sm"
    >
      {classes.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function EditableRow({ row, classes }: { row: Row; classes: ClassOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const dirty =
    form.name !== row.name ||
    form.class !== row.class ||
    form.countsAsAbsence !== row.countsAsAbsence ||
    form.isActive !== row.isActive;

  function save() {
    setError(null);
    startTransition(async () => {
      const res: AbsenceTypeState = await updateAbsenceTypeDefaultAction({
        id: row.id,
        name: form.name,
        class: form.class,
        countsAsAbsence: form.countsAsAbsence,
        isActive: form.isActive,
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <tr className="border-b align-top">
      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.code}</td>
      <td className="px-4 py-2">
        <input
          aria-label={`Nombre de ${row.code}`}
          value={form.name}
          maxLength={100}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border bg-background px-2 py-1 text-sm"
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-2">
        <label htmlFor={`class-${row.id}`} className="sr-only">
          Clase de {row.code}
        </label>
        <ClassSelect
          id={`class-${row.id}`}
          value={form.class}
          classes={classes}
          onChange={(v) => setForm({ ...form, class: v })}
        />
      </td>
      <td className="px-4 py-2 text-center">
        <Switch
          checked={form.countsAsAbsence}
          label={`${row.code}: cuenta como ausentismo`}
          onChange={(v) => setForm({ ...form, countsAsAbsence: v })}
        />
      </td>
      <td className="px-4 py-2 text-center">
        <Switch
          checked={form.isActive}
          label={`${row.code}: activo`}
          onChange={(v) => setForm({ ...form, isActive: v })}
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          type="button"
          disabled={pending || !dirty || form.name.trim() === ""}
          onClick={save}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
        >
          Guardar
        </button>
      </td>
    </tr>
  );
}

export function NewAbsenceTypeDialog({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const empty = { code: "", name: "", class: classes[0]?.code ?? "other", countsAsAbsence: true };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await createAbsenceTypeDefaultAction({ ...form, isActive: true });
      if (res.error) setError(res.error);
      else {
        setForm(empty);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Agregar tipo
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar tipo</DialogTitle>
            <DialogDescription>Los tenants nuevos reciben este tipo. Los tenants existentes no se modifican.</DialogDescription>
          </DialogHeader>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}
      <div className="grid gap-3">
        <div>
          <label htmlFor="new-code" className="mb-1 block text-xs font-medium">
            Código
          </label>
          <input
            id="new-code"
            value={form.code}
            maxLength={50}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="new-name" className="mb-1 block text-xs font-medium">
            Nombre
          </label>
          <input
            id="new-name"
            value={form.name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="new-class" className="mb-1 block text-xs font-medium">
            Clase
          </label>
          <ClassSelect id="new-class" value={form.class} classes={classes} onChange={(v) => setForm({ ...form, class: v })} />
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-xs">
          <Switch
            checked={form.countsAsAbsence}
            label="Cuenta como ausentismo"
            onChange={(v) => setForm({ ...form, countsAsAbsence: v })}
          />
          Cuenta como ausentismo
        </label>
        <button
          type="button"
          disabled={pending || !form.code.trim() || !form.name.trim()}
          onClick={create}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AbsenceTypesTable({ rows, classes }: { rows: Row[]; classes: ClassOption[] }) {
  return (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Código</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">Clase</th>
              <th className="h-10 px-4 text-center font-medium text-muted-foreground">Cuenta como ausentismo</th>
              <th className="h-10 px-4 text-center font-medium text-muted-foreground">Activo</th>
              <th className="h-10 px-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <EditableRow key={`${r.id}-${r.name}-${r.class}-${r.countsAsAbsence}-${r.isActive}`} row={r} classes={classes} />
            ))}
          </tbody>
        </table>
    </div>
  );
}
