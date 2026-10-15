"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetShiftScheduleAction, saveShiftScheduleAction } from "../_actions/shifts.actions";

interface Schedule {
  dailyHours: number;
  weeklyHours: number | null;
  monthlyHours: number | null;
  workWeek: string;
}

export interface ShiftRow {
  id: number;
  code: string;
  name: string;
  people: number;
  schedule: Schedule | null;
}

interface Defaults {
  workWeek: string;
  dailyHours: number;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
const fmt = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
const workDays = (w: string) => w.split("").filter((c) => c === "1").length;

function WeekPicker({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días laborables">
      {DAYS.map((d, i) => {
        const on = value[i] === "1";
        return (
          <label
            key={d}
            htmlFor={`${idPrefix}-${i}`}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
              on ? "border-green-300 bg-green-50 text-green-900" : "bg-muted/40 text-muted-foreground"
            } ${disabled ? "" : "cursor-pointer"}`}
          >
            <input
              id={`${idPrefix}-${i}`}
              type="checkbox"
              checked={on}
              disabled={disabled}
              onChange={() => {
                const chars = value.split("");
                chars[i] = on ? "0" : "1";
                onChange?.(chars.join(""));
              }}
            />
            {d}
          </label>
        );
      })}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        step="0.5"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 rounded-md border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function ShiftEditor({ row, defaults, onClose }: { row: ShiftRow; defaults: Defaults; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initial = row.schedule ?? { dailyHours: defaults.dailyHours, weeklyHours: null, monthlyHours: null, workWeek: defaults.workWeek };
  const [daily, setDaily] = useState(String(initial.dailyHours));
  const [weekly, setWeekly] = useState(initial.weeklyHours === null ? "" : String(initial.weeklyHours));
  const [monthly, setMonthly] = useState(initial.monthlyHours === null ? "" : String(initial.monthlyHours));
  const [workWeek, setWorkWeek] = useState(initial.workWeek);

  const dailyN = Number(daily);
  const expectedWeekly = Number.isFinite(dailyN) ? dailyN * workDays(workWeek) : 0;
  const weeklyN = weekly === "" ? null : Number(weekly);
  const mismatch = weeklyN !== null && Number.isFinite(weeklyN) && expectedWeekly > 0 && Math.abs(weeklyN - expectedWeekly) > 0.01;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveShiftScheduleAction({
        orgUnitId: row.id,
        dailyHours: dailyN,
        weeklyHours: weekly === "" ? null : Number(weekly),
        monthlyHours: monthly === "" ? null : Number(monthly),
        workWeek,
      });
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  function reset() {
    setError(null);
    startTransition(async () => {
      const res = await resetShiftScheduleAction({ orgUnitId: row.id });
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="space-y-4 border-t bg-muted/20 px-4 py-4" aria-busy={pending}>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <NumberField id={`daily-${row.id}`} label="Horas por día" value={daily} onChange={setDaily} />
        <NumberField id={`weekly-${row.id}`} label="Horas por semana (opcional)" value={weekly} onChange={setWeekly} placeholder={fmt(expectedWeekly)} />
        <NumberField id={`monthly-${row.id}`} label="Horas por mes (opcional)" value={monthly} onChange={setMonthly} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-foreground">Semana laboral</p>
        <WeekPicker value={workWeek} onChange={setWorkWeek} idPrefix={`wk-${row.id}`} />
      </div>
      <p className="text-xs text-muted-foreground">
        Con estos datos el turno programa {fmt(expectedWeekly)} horas por semana.
        {mismatch && (
          <span className="ml-1 font-medium text-amber-700">
            Las horas semanales cargadas no coinciden. Para el cálculo se usan las horas por día y la semana laboral.
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" disabled={pending} onClick={onClose} className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
          Cancelar
        </button>
        {row.schedule && (
          <button
            type="button"
            disabled={pending}
            onClick={reset}
            className="ml-auto rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Usar horario de la empresa
          </button>
        )}
      </div>
    </div>
  );
}

export function ShiftsTable({ rows, defaults, canEdit }: { rows: ShiftRow[]; defaults: Defaults; canEdit: boolean }) {
  const [editing, setEditing] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
        Todavía no hay turnos. Se crean al cargar archivos de Personas o de Historial de unidades que incluyan el tipo
        Turno.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Horario de la empresa (para turnos sin horario propio y personas sin turno): {fmt(defaults.dailyHours)} h por
        día, {workDays(defaults.workWeek)} días por semana.
      </p>
      <ul className="divide-y rounded-md border">
        {rows.map((r) => {
          const sch = r.schedule;
          const week = sch?.workWeek ?? defaults.workWeek;
          const daily = sch?.dailyHours ?? defaults.dailyHours;
          return (
            <li key={r.id}>
              <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{r.code}</span> · {r.people} {r.people === 1 ? "persona" : "personas"}
                  </p>
                </div>
                <div>
                  <WeekPicker value={week} disabled idPrefix={`view-${r.id}`} />
                </div>
                <p className="w-40 text-xs text-muted-foreground">
                  {fmt(daily)} h por día
                  <br />
                  {sch ? "Horario propio" : "Usa el horario de la empresa"}
                </p>
                {canEdit && (
                  <button
                    type="button"
                    aria-expanded={editing === r.id}
                    onClick={() => setEditing(editing === r.id ? null : r.id)}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    {editing === r.id ? "Cerrar" : "Editar"}
                  </button>
                )}
              </div>
              {canEdit && editing === r.id && (
                <ShiftEditor key={r.id} row={r} defaults={defaults} onClose={() => setEditing(null)} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
