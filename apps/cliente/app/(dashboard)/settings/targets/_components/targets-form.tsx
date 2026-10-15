"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetTargetAction, saveTargetAction } from "../_actions/targets.actions";

interface TargetRow {
  code: string;
  label: string;
  description: string;
  unitLabel: string;
  defaultValue: number;
  /** null = sin meta propia (usa el valor por defecto) */
  value: number | null;
}

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

function TargetItem({ row, canEdit }: { row: TargetRow; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = row.value ?? row.defaultValue;
  const [text, setText] = useState(String(current));
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const parsed = Number(text.replace(",", "."));
  const valid = text.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const dirty = valid && parsed !== current;

  function run(fn: () => Promise<{ error?: string }>, okText: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setMessage({ type: "error", text: res.error });
      else {
        setMessage({ type: "ok", text: okText });
        router.refresh();
      }
    });
  }

  return (
    <li className="space-y-3 rounded-xl border bg-card p-5" aria-busy={pending}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{row.label}</h2>
        <p className="text-xs text-muted-foreground">{row.description}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`target-${row.code}`} className="mb-1 block text-xs font-medium text-foreground">
            Meta ({row.unitLabel})
          </label>
          <input
            id={`target-${row.code}`}
            type="text"
            inputMode="decimal"
            value={text}
            disabled={!canEdit}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={!valid}
            className="w-28 rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
          />
        </div>
        {canEdit && (
          <>
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={() => run(() => saveTargetAction({ metricCode: row.code, targetValue: parsed }), "Guardado")}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Guardar
            </button>
            {row.value !== null && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  run(() => resetTargetAction({ metricCode: row.code }), "Se usa el valor por defecto");
                  setText(String(row.defaultValue));
                }}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
              >
                Usar valor por defecto
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {row.value === null
          ? `Se usa el valor por defecto (${fmt(row.defaultValue)} ${row.unitLabel}).`
          : `Meta propia de la empresa. El valor por defecto es ${fmt(row.defaultValue)} ${row.unitLabel}.`}
        {!valid && <span className="ml-1 font-medium text-red-700">Ingresá un número entre 0 y 100.</span>}
      </p>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`text-xs ${message.type === "error" ? "text-red-700" : "text-green-700"}`}
        >
          {message.text}
        </p>
      )}
    </li>
  );
}

export function TargetsForm({ rows, canEdit }: { rows: TargetRow[]; canEdit: boolean }) {
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <TargetItem key={`${r.code}-${r.value}`} row={r} canEdit={canEdit} />
      ))}
    </ul>
  );
}
