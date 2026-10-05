"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@wla/ui";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  getUploadUrlAction,
  confirmUploadAction,
  type PresignState,
  type ConfirmUploadState,
} from "../_actions/upload.actions";

interface FileUploadProps {
  integrationId: number;
  integrationName: string;
}

type UploadStep = "idle" | "uploading" | "confirming" | "done" | "error";

export function FileUpload({ integrationId, integrationName }: FileUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<UploadStep>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Server actions (solo para obtener URL y confirmar — el PUT lo hace el browser)
  const [, getUrl] = useActionState<PresignState, FormData>(getUploadUrlAction, {});
  const [, confirm] = useActionState<ConfirmUploadState, FormData>(confirmUploadAction, {});
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setStep("idle");
    setErrorMsg(null);
    setJobId(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setStep("uploading");
    setErrorMsg(null);

    // Paso 1: pedir URL pre-firmada al servidor
    const formData1 = new FormData();
    formData1.append("integrationId", String(integrationId));
    formData1.append("filename", selectedFile.name);
    formData1.append("contentType", selectedFile.type || "application/octet-stream");
    formData1.append("fileSizeBytes", String(selectedFile.size));

    let presignResult: PresignState = {};
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        presignResult = await getUploadUrlAction({}, formData1);
        resolve();
      });
    });

    if (presignResult.error || !presignResult.presignedUrl || !presignResult.storagePath) {
      setErrorMsg(presignResult.error ?? "Error al obtener URL de subida");
      setStep("error");
      return;
    }

    // Paso 2: PUT directo al bucket R2 desde el browser (sin pasar por nuestro server)
    try {
      const putResponse = await fetch(presignResult.presignedUrl, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
      });
      if (!putResponse.ok) {
        throw new Error(`R2 respondió ${putResponse.status}`);
      }
    } catch (err) {
      setErrorMsg("Error al subir el archivo. Intentá de nuevo.");
      setStep("error");
      return;
    }

    // Paso 3: notificar al servidor para crear el job
    setStep("confirming");
    const formData2 = new FormData();
    formData2.append("integrationId", String(integrationId));
    formData2.append("storagePath", presignResult.storagePath);
    formData2.append("filename", selectedFile.name);

    let confirmResult: ConfirmUploadState = {};
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        confirmResult = await confirmUploadAction({}, formData2);
        resolve();
      });
    });

    if (confirmResult.error || !confirmResult.jobId) {
      setErrorMsg(confirmResult.error ?? "Error al crear el job");
      setStep("error");
      return;
    }

    setJobId(confirmResult.jobId);
    setStep("done");
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h3 className="font-medium text-sm text-foreground">{integrationName}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Formatos aceptados: CSV, XLSX, XLS — máx. 20 MB
        </p>
      </div>

      {/* Zona de selección de archivo */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {selectedFile ? (
            <span className="text-foreground font-medium">{selectedFile.name}</span>
          ) : (
            "Hacé clic o arrastrá un archivo aquí"
          )}
        </p>
        {selectedFile && (
          <p className="text-xs text-muted-foreground mt-1">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Estado del proceso */}
      {step === "done" && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Archivo enviado. Job #{jobId} creado — el worker lo procesará en breve.</span>
        </div>
      )}

      {step === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {(step === "uploading" || step === "confirming") && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{step === "uploading" ? "Subiendo archivo..." : "Creando job..."}</span>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!selectedFile || step === "uploading" || step === "confirming" || isPending}
        className="w-full"
      >
        {step === "uploading" || step === "confirming" || isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Subir y procesar
          </>
        )}
      </Button>
    </div>
  );
}
