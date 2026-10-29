"use client";

import { Fragment, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleTemplateAction, type ToggleTemplateState } from "../_actions/templates.actions";

interface Template {
  code: string;
  name: string;
  category: string;
  targetModel: string;
  isActive: boolean;
  /** Integraciones activas de los tenants que usan el template */
  inUse: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  file: "Archivo",
  api: "API",
};

const TARGET_LABELS: Record<string, string> = {
  people: "Personas",
  time: "Asistencia",
  payroll: "Liquidaciones",
  absenteeism: "Ausentismos",
  org_history: "Unidades organizativas",
};

function TemplateToggle({ template }: { template: Template }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const formData = new FormData();
    formData.set("code", template.code);
    formData.set("isActive", String(!template.isActive));
    startTransition(async () => {
      const result: ToggleTemplateState = await toggleTemplateAction({}, formData);
      if (!result.error) router.refresh();
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={template.isActive}
      disabled={isPending}
      onClick={handleToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
        template.isActive ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          template.isActive ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function TemplatesTable({ templates }: { templates: Template[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Templates de integración</caption>
        <thead>
          <tr className="border-b bg-muted/50">
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Código</th>
            <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
            <th scope="col" className="h-10 px-4 text-center font-medium text-muted-foreground">Módulo</th>
            <th scope="col" className="h-10 px-4 text-center font-medium text-muted-foreground">En uso</th>
            <th scope="col" className="h-10 px-4 text-center font-medium text-muted-foreground">Activo</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t, i) => (
            <Fragment key={t.code}>
              {(i === 0 || templates[i - 1]!.category !== t.category) && (
                <tr className="bg-muted/40">
                  <th scope="colgroup" colSpan={5} className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </th>
                </tr>
              )}
              <tr className="border-t">
                <td className="h-12 px-4 font-mono text-xs text-muted-foreground">{t.code}</td>
                <td className="h-12 px-4 font-medium">{t.name}</td>
                <td className="h-12 px-4 text-center text-sm text-muted-foreground">{TARGET_LABELS[t.targetModel] ?? t.targetModel}</td>
                <td className="h-12 px-4 text-center text-sm tabular-nums">
                  {t.inUse === 0 ? <span className="text-muted-foreground">—</span> : `${t.inUse} ${t.inUse === 1 ? "integración" : "integraciones"}`}
                </td>
                <td className="h-12 px-4 text-center">
                  <TemplateToggle template={t} />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
