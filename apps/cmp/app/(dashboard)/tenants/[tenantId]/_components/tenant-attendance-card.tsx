"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAttendanceSettingsAction } from "../_actions/attendance.actions";

export interface AttendanceSettings {
  attendanceMode: "basic" | "detailed";
  defaultWorkWeek: string;
  defaultDailyHours: number;
  absenceDisplay: "hours" | "days" | "both";
  overtimeBase: "scheduled" | "worked";
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const MODES = [
  ["basic", "Básica", "Horas programadas según el turno de cada persona (o el horario por defecto)."],
  ["detailed", "Detallada", "Asistencia diaria teórica y efectiva por integración (API). Pendiente de implementar."],
] as const;

export function TenantAttendanceCard({ tenantId, settings }: { tenantId: string; settings: AttendanceSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  function toggleDay(i: number) {
    const chars = form.defaultWorkWeek.split("");
    chars[i] = chars[i] === "1" ? "0" : "1";
    setForm({ ...form, defaultWorkWeek: chars.join("") });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateAttendanceSettingsAction({ tenantId, ...form });
      setMessage(res.error ? { type: "error", text: res.error } : { type: "ok", text: "Guardado" });
      if (!res.error) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5" aria-busy={pending}>
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Asistencia</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Define cómo se calculan las horas programadas para el ausentismo. Los turnos (unidades de tipo Turno) se
          administran desde el portal del cliente.
        </p>
      </div>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-xs ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Definición de asistencia</legend>
          <div className="space-y-2">
            {MODES.map(([value, label, help]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2">
                <input
                  type="radio"
                  name="attendanceMode"
                  value={value}
                  checked={form.attendanceMode === value}
                  onChange={() => setForm({ ...form, attendanceMode: value })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">Semana laboral por defecto</legend>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
                    form.defaultWorkWeek[i] === "1" ? "border-green-300 bg-green-50" : "bg-muted/40"
                  }`}
                >
                  <input type="checkbox" checked={form.defaultWorkWeek[i] === "1"} onChange={() => toggleDay(i)} />
                  {d}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Se aplica a las personas sin turno asignado.</p>
          </fieldset>

          <div className="flex flex-wrap gap-6">
            <div>
              <label htmlFor="daily-hours" className="mb-1 block text-sm font-medium text-foreground">
                Horas por día
              </label>
              <input
                id="daily-hours"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={form.defaultDailyHours}
                onChange={(e) => setForm({ ...form, defaultDailyHours: Number(e.target.value) })}
                className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="absence-display" className="mb-1 block text-sm font-medium text-foreground">
                Mostrar ausencias en
              </label>
              <select
                id="absence-display"
                value={form.absenceDisplay}
                onChange={(e) =>
                  setForm({ ...form, absenceDisplay: e.target.value as AttendanceSettings["absenceDisplay"] })
                }
                className="rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="both">Horas y días</option>
                <option value="hours">Horas</option>
                <option value="days">Días</option>
              </select>
            </div>
            <div>
              <label htmlFor="overtime-base" className="mb-1 block text-sm font-medium text-foreground">
                Tasa de horas extra sobre
              </label>
              <select
                id="overtime-base"
                value={form.overtimeBase}
                onChange={(e) => setForm({ ...form, overtimeBase: e.target.value as AttendanceSettings["overtimeBase"] })}
                className="rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="scheduled">Horas programadas</option>
                <option value="worked">Horas trabajadas</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={save}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
