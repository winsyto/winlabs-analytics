"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@wla/ui";
import { toggleTemplateAction, type ToggleTemplateState } from "../_actions/templates.actions";

interface Template {
  code: string;
  name: string;
  category: string;
  targetModel: string;
  isActive: boolean;
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
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-md border">
        <p className="text-muted-foreground text-sm">No hay templates registrados.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Código</th>
            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Nombre</th>
            <th className="h-10 px-4 text-center font-medium text-muted-foreground">Categoría</th>
            <th className="h-10 px-4 text-center font-medium text-muted-foreground">Módulo</th>
            <th className="h-10 px-4 text-center font-medium text-muted-foreground">Activo</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t, idx) => (
            <tr key={t.code} className={idx < templates.length - 1 ? "border-b" : ""}>
              <td className="h-12 px-4 font-mono text-xs text-muted-foreground">{t.code}</td>
              <td className="h-12 px-4 font-medium">{t.name}</td>
              <td className="h-12 px-4 text-center">
                <Badge variant="secondary" className="text-xs">
                  {CATEGORY_LABELS[t.category] ?? t.category}
                </Badge>
              </td>
              <td className="h-12 px-4 text-center text-sm text-muted-foreground">
                {TARGET_LABELS[t.targetModel] ?? t.targetModel}
              </td>
              <td className="h-12 px-4 text-center">
                <TemplateToggle template={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
