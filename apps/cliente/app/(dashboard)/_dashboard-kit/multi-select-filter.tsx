"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@wla/ui";
import { useDashboardParams } from "./dashboard-shell";

interface Option {
  value: string;
  label: string;
}

export function MultiSelectFilter({
  label,
  paramKey,
  options,
  selected,
}: {
  label: string;
  paramKey: string;
  options: Option[];
  selected: string[];
}) {
  const { setParams } = useDashboardParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    setParams({ [paramKey]: next.length ? next.join(",") : null });
  };

  const active = selected.length > 0;
  const summary = !active
    ? "Todos"
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? "1")
      : `${selected.length} seleccionados`;
  const visible = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex max-w-[15rem] items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          active ? "border-foreground font-medium" : "text-muted-foreground"
        )}
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className={cn("truncate", active && "text-foreground")}>{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`Filtrar por ${label}`}
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md"
        >
          {options.length > 8 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar ${label.toLowerCase()}…`}
              aria-label={`Buscar ${label}`}
              className="mb-1 w-full rounded border bg-background px-2 py-1 text-xs"
            />
          )}
          <ul className="max-h-60 overflow-auto">
            {visible.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">Sin opciones</li>
            )}
            {visible.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                      className="sr-only peer"
                    />
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 items-center justify-center rounded border peer-focus-visible:outline-2 peer-focus-visible:outline-ring",
                        checked && "border-foreground bg-foreground text-background"
                      )}
                      aria-hidden
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
