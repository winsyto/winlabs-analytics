import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  text: string;
  cta?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, text, cta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed bg-muted/30 p-12 text-center flex flex-col items-center gap-3",
        className
      )}
    >
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">{text}</p>
      {cta && (
        <Button
          variant="outline"
          size="sm"
          onClick={cta.onClick}
          asChild={!!cta.href}
        >
          {cta.href ? <a href={cta.href}>{cta.label}</a> : cta.label}
        </Button>
      )}
    </div>
  );
}
