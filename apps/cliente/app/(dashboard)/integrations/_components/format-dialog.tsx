"use client";

import type { ReactNode } from "react";
import { Columns3 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@wla/ui";

/** Botón «Ver formato del archivo» y su ventana; el contenido (columnas y ejemplo) llega del servidor como `children` */
export function FormatDialog({ integrationName, children }: { integrationName: string; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 aria-hidden /> Ver formato del archivo
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Formato del archivo</DialogTitle>
          <DialogDescription>{integrationName}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
