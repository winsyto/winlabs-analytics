"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";

interface ExportMenuProps {
  xlsxHref: string;
  pdfHref: string;
}

export function ExportMenu({ xlsxHref, pdfHref }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const start = () => {
    setOpen(false);
    setBusy(true);
    setTimeout(() => setBusy(false), 6000);
  };

  const item =
    "flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Generando…" : "Exportar"}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span role="status" className="sr-only">
        {busy ? "Generando el archivo, la descarga comenzará en unos segundos" : ""}
      </span>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-md border bg-popover p-1 shadow-md">
          <a href={xlsxHref} download onClick={start} className={item}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Excel (.xlsx)
          </a>
          <a href={pdfHref} download onClick={start} className={item}>
            <FileText className="h-4 w-4" aria-hidden />
            PDF paginado (.pdf)
          </a>
          <p className="px-2 pb-1 pt-1.5 text-[11px] text-muted-foreground">
            Incluye el período y los filtros activos.
          </p>
        </div>
      )}
    </div>
  );
}
