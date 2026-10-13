"use client";

import { createContext, useCallback, useContext, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@wla/ui";

interface DashboardCtx {
  isPending: boolean;
  setParams: (updates: Record<string, string | null>) => void;
}

const Ctx = createContext<DashboardCtx | null>(null);

export function useDashboardParams(): DashboardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardParams must be used inside <DashboardShell>");
  return ctx;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  return (
    <Ctx.Provider value={{ isPending, setParams }}>
      <div className="flex h-full min-h-[640px] flex-col gap-3 p-4" aria-busy={isPending}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** Atenúa la región de datos mientras se recalcula tras un cambio de filtro. */
export function PendingRegion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isPending } = useDashboardParams();
  return (
    <div
      className={cn(className, isPending && "opacity-60 transition-opacity")}
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export function PendingIndicator() {
  const { isPending } = useDashboardParams();
  return (
    <span role="status" className="text-xs text-muted-foreground">
      {isPending ? "Actualizando…" : ""}
    </span>
  );
}
