"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Badge, Button } from "@wla/ui";
import {
  toggleIntegrationStatusAction,
  type ToggleIntegrationState,
} from "../../_actions/integrations.actions";

interface Run {
  id: number;
  status: string;
  triggerSource: string;
  startedAt: Date;
  finishedAt: Date | null;
  rowsRead: number;
  rowsLoaded: number;
  rowsError: number;
  rowsWarning: number;
  errorMessage: string | null;
}

interface IntegrationDetailProps {
  integration: {
    id: number;
    tenantId: string;
    tenantName: string;
    name: string;
    status: string;
    scheduleCron: string | null;
    lastRunAt: Date | null;
    lastSuccessAt: Date | null;
    templateName: string;
    templateCategory: string;
    createdAt: Date;
  };
  runs: Run[];
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  paused: "secondary",
  error: "destructive",
  running: "default",
  success: "default",
  partial: "secondary",
  failed: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  paused: "Pausada",
  error: "Error",
  running: "Corriendo",
  success: "Exitoso",
  partial: "Parcial",
  failed: "Falló",
};

const TRIGGER_LABELS: Record<string, string> = {
  cron: "Programado",
  manual: "Manual",
  upload: "Carga archivo",
};

const CATEGORY_LABELS: Record<string, string> = {
  file: "Archivo",
  api: "API",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function durationLabel(start: Date, end: Date | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

const initialState: ToggleIntegrationState = {};

export function IntegrationDetail({ integration, runs }: IntegrationDetailProps) {
  const nextStatus = integration.status === "active" ? "paused" : "active";
  const [state, formAction, isPending] = useActionState(
    toggleIntegrationStatusAction,
    initialState
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{integration.name}</h1>
            <Badge variant={STATUS_VARIANTS[integration.status] ?? "secondary"}>
              {STATUS_LABELS[integration.status] ?? integration.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {integration.tenantName} ·{" "}
            {integration.templateName} (
            {CATEGORY_LABELS[integration.templateCategory] ?? integration.templateCategory})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/integrations">← Volver</Link>
          </Button>

          <form action={formAction}>
            <input type="hidden" name="integrationId" value={integration.id} />
            <input type="hidden" name="tenantId" value={integration.tenantId} />
            <input type="hidden" name="newStatus" value={nextStatus} />
            <Button
              type="submit"
              variant={integration.status === "active" ? "outline" : "default"}
              size="sm"
              disabled={isPending}
            >
              {isPending
                ? "Guardando..."
                : integration.status === "active"
                ? "Pausar"
                : "Activar"}
            </Button>
          </form>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Schedule", value: integration.scheduleCron ?? "Manual" },
          { label: "Último run", value: formatDate(integration.lastRunAt) },
          { label: "Último éxito", value: formatDate(integration.lastSuccessAt) },
          { label: "Creada", value: formatDate(integration.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

      {/* Runs table */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Historial de runs</h2>

        {runs.length === 0 ? (
          <div className="rounded-md border py-12 text-center">
            <p className="text-sm text-muted-foreground">Sin runs registrados.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Inicio</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="h-10 px-4 text-center font-medium text-muted-foreground">Estado</th>
                  <th className="h-10 px-4 text-center font-medium text-muted-foreground">Duración</th>
                  <th className="h-10 px-4 text-center font-medium text-muted-foreground">Leídas</th>
                  <th className="h-10 px-4 text-center font-medium text-muted-foreground">OK</th>
                  <th className="h-10 px-4 text-center font-medium text-muted-foreground">Errores</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, idx) => (
                  <tr key={run.id} className={idx < runs.length - 1 ? "border-b" : ""}>
                    <td className="h-12 px-4 text-muted-foreground">
                      {formatDate(run.startedAt)}
                    </td>
                    <td className="h-12 px-4 text-muted-foreground">
                      {TRIGGER_LABELS[run.triggerSource] ?? run.triggerSource}
                    </td>
                    <td className="h-12 px-4 text-center">
                      <Badge
                        variant={STATUS_VARIANTS[run.status] ?? "secondary"}
                        className="text-xs"
                      >
                        {STATUS_LABELS[run.status] ?? run.status}
                      </Badge>
                    </td>
                    <td className="h-12 px-4 text-center text-muted-foreground">
                      {durationLabel(run.startedAt, run.finishedAt)}
                    </td>
                    <td className="h-12 px-4 text-center">{run.rowsRead}</td>
                    <td className="h-12 px-4 text-center text-green-600 dark:text-green-400">
                      {run.rowsLoaded}
                    </td>
                    <td className="h-12 px-4 text-center text-destructive">
                      {run.rowsError > 0 ? run.rowsError : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
