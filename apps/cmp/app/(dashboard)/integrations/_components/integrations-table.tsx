"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@wla/ui";
import {
  deleteIntegrationAction,
  type DeleteIntegrationState,
} from "../_actions/integrations.actions";

interface Integration {
  id: number;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  name: string;
  templateName: string;
  templateCategory: string;
  status: string;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
}

interface Tenant {
  id: string;
  name: string;
}

interface IntegrationsTableProps {
  integrations: Integration[];
  tenants: Tenant[];
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  paused: "Pausada",
  error: "Error",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  paused: "secondary",
  error: "destructive",
};

const CATEGORY_LABELS: Record<string, string> = {
  file: "Archivo",
  api: "API",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// ─── Confirm delete dialog ────────────────────────────────────────────────────

const deleteInitial: DeleteIntegrationState = {};

function DeleteConfirmDialog({
  integration,
  open,
  onClose,
}: {
  integration: Integration;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteIntegrationAction,
    deleteInitial
  );

  const prevSuccess = useRef(state.success);
  useEffect(() => {
    if (state.success && !prevSuccess.current) {
      prevSuccess.current = true;
      setTimeout(onClose, 0);
    }
    if (!state.success) prevSuccess.current = false;
  }, [state.success, onClose]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar integración</DialogTitle>
          <DialogDescription>
            ¿Eliminás <strong>{integration.name}</strong> de{" "}
            <strong>{integration.tenantName}</strong>? Esta acción no se puede
            deshacer y borrará todos los runs asociados.
          </DialogDescription>
        </DialogHeader>

        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <form action={formAction}>
          <input type="hidden" name="integrationId" value={integration.id} />
          <input type="hidden" name="tenantId" value={integration.tenantId} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Row actions dropdown ─────────────────────────────────────────────────────

function RowActions({ integration }: { integration: Integration }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <>
      <div ref={menuRef} className="relative inline-block">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Acciones"
        >
          •••
        </Button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-1 w-36 rounded-md border bg-popover shadow-md text-sm">
            <Link
              href={`/integrations/${integration.id}?tenantId=${integration.tenantId}`}
              className="flex w-full items-center px-3 py-2 hover:bg-accent rounded-t-md"
              onClick={() => setMenuOpen(false)}
            >
              Ver detalle
            </Link>
            <button
              type="button"
              className="flex w-full items-center px-3 py-2 text-destructive hover:bg-accent rounded-b-md"
              onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <DeleteConfirmDialog
          integration={integration}
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function IntegrationsTable({ integrations, tenants }: IntegrationsTableProps) {
  const [filterTenantId, setFilterTenantId] = useState<string>("");

  const filtered = filterTenantId
    ? integrations.filter((i) => i.tenantId === filterTenantId)
    : integrations;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground shrink-0">
          Filtrar por tenant:
        </label>
        <select
          value={filterTenantId}
          onChange={(e) => setFilterTenantId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-md border">
          <p className="text-muted-foreground text-sm">
            No hay integraciones configuradas.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="h-10 px-4 text-left font-medium text-muted-foreground">Tenant</th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground">Integración</th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground">Template</th>
                <th className="h-10 px-4 text-center font-medium text-muted-foreground">Estado</th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground">Último run</th>
                <th className="h-10 px-4 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((integration, idx) => (
                <tr
                  key={integration.id}
                  className={idx < filtered.length - 1 ? "border-b" : ""}
                >
                  <td className="h-14 px-4">
                    <p className="font-medium">{integration.tenantName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {integration.tenantSlug}
                    </p>
                  </td>
                  <td className="h-14 px-4">
                    <p className="font-medium">{integration.name}</p>
                  </td>
                  <td className="h-14 px-4">
                    <p>{integration.templateName}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[integration.templateCategory] ?? integration.templateCategory}
                    </p>
                  </td>
                  <td className="h-14 px-4 text-center">
                    <Badge
                      variant={STATUS_VARIANTS[integration.status] ?? "secondary"}
                      className="text-xs"
                    >
                      {STATUS_LABELS[integration.status] ?? integration.status}
                    </Badge>
                  </td>
                  <td className="h-14 px-4 text-sm text-muted-foreground">
                    {formatDate(integration.lastRunAt)}
                  </td>
                  <td className="h-14 px-4 text-right">
                    <RowActions integration={integration} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
