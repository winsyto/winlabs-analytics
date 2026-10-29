"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@wla/ui";
import { confirmUploadAction, getUploadUrlAction } from "../_actions/upload.actions";
import { getJobSummaryAction } from "../_actions/history.actions";
import { durationLabel, type JobSummary } from "../_data/job-result";
import { JobDetail } from "./job-result-view";
import { StatusPill } from "./status-pill";

const ALLOWED = ["csv", "xlsx", "xls"];
const MAX_MB = 20;
const POLL_MS = 2000;

type Step = "idle" | "ready" | "uploading" | "processing" | "done" | "error";

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Valida el archivo antes de subirlo; devuelve el motivo del rechazo o null */
function validate(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED.includes(ext)) return `Formato no soportado (.${ext || "?"}). Usá CSV, XLSX o XLS.`;
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_MB * 1024 * 1024) return `El archivo pesa ${fmtSize(file.size)} y el máximo es ${MAX_MB} MB.`;
  return null;
}

/** Barra de pasos: Subiendo → Procesando → Listo */
function Steps({ step }: { step: Step }) {
  const order: Step[] = ["uploading", "processing", "done"];
  const labels = ["Subiendo", "Procesando", "Listo"];
  const at = step === "done" ? 3 : order.indexOf(step);
  return (
    <ol className="flex gap-1" aria-label="Avance de la carga">
      {labels.map((l, i) => {
        const state = i < at ? "done" : i === at ? "on" : "off";
        return (
          <li key={l} className={`flex-1 space-y-1 text-xs ${state === "off" ? "text-muted-foreground" : "font-medium text-foreground"}`} aria-current={state === "on" ? "step" : undefined}>
            <span className={`block h-1 rounded ${state === "done" ? "bg-wla-good" : state === "on" ? "bg-foreground" : "bg-border"}`} />
            {l}
          </li>
        );
      })}
    </ol>
  );
}

export function UploadPanel({ integrationId, formatButton }: { integrationId: number; formatButton: ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);

  const pick = useCallback((f: File | null | undefined) => {
    if (!f) return;
    const problem = validate(f);
    setJob(null);
    setJobId(null);
    if (problem) {
      setFile(null);
      setStep("error");
      setMessage(problem);
      return;
    }
    setFile(f);
    setStep("ready");
    setMessage(null);
  }, []);

  function reset() {
    setFile(null);
    setStep("idle");
    setMessage(null);
    setJob(null);
    setJobId(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setStep("uploading");
    setMessage(null);
    try {
      const fd1 = new FormData();
      fd1.append("integrationId", String(integrationId));
      fd1.append("filename", file.name);
      fd1.append("contentType", file.type || "application/octet-stream");
      fd1.append("fileSizeBytes", String(file.size));
      const presign = await getUploadUrlAction({}, fd1);
      if (presign.error || !presign.presignedUrl || !presign.storagePath) throw new Error(presign.error ?? "No se pudo preparar la subida.");

      const put = await fetch(presign.presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!put.ok) throw new Error("No se pudo subir el archivo. Intentá de nuevo.");

      const fd2 = new FormData();
      fd2.append("integrationId", String(integrationId));
      fd2.append("storagePath", presign.storagePath);
      fd2.append("filename", file.name);
      const confirmed = await confirmUploadAction({}, fd2);
      if (confirmed.error || !confirmed.jobId) throw new Error(confirmed.error ?? "No se pudo iniciar el procesamiento.");

      setJobId(confirmed.jobId);
      setStep("processing");
    } catch (e) {
      setStep("error");
      setMessage(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    }
  }

  // Sigue la carga hasta que termina, sin recargar la página
  useEffect(() => {
    if (step !== "processing" || jobId === null) return;
    let stopped = false;
    const tick = async () => {
      const s = await getJobSummaryAction(jobId);
      if (stopped || !s) return;
      setJob(s);
      if (s.state !== "running") {
        setStep("done");
        router.refresh();
      }
    };
    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [step, jobId, router]);

  const busy = step === "uploading" || step === "processing";

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-lg border bg-card p-4" aria-labelledby="upload-title">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="upload-title" className="text-sm font-semibold">Cargar archivo</h2>
            <p className="text-xs text-muted-foreground">CSV, XLSX o XLS · hasta {MAX_MB} MB. El archivo actualiza los datos existentes según su contenido.</p>
          </div>
          {formatButton}
        </div>

        {file && step !== "idle" ? (
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-background px-4 py-6 text-sm">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">{fmtSize(file.size)}</span>
            {!busy && step !== "done" && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X aria-hidden /> Quitar
              </Button>
            )}
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Elegir un archivo o soltarlo acá"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring ${over ? "border-foreground bg-muted" : "bg-background hover:border-foreground/40"}`}
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="mt-1 text-sm">
              <span className="font-semibold">Arrastrá el archivo acá</span> o hacé clic para elegirlo
            </p>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

        {(busy || step === "done") && <Steps step={step} />}
        {step === "processing" && (
          <p role="status" className="text-xs text-muted-foreground">
            Procesando el archivo… podés quedarte en esta pantalla: el resultado aparece acá.
          </p>
        )}
        {message && (
          <p role="alert" className="text-sm text-wla-bad">
            {message}
          </p>
        )}

        <div className="flex items-center gap-2">
          {step === "done" ? (
            <Button variant="outline" onClick={reset}>
              <Upload aria-hidden /> Cargar otro archivo
            </Button>
          ) : (
            <Button onClick={upload} disabled={step !== "ready"}>
              <Upload aria-hidden /> {busy ? "Procesando…" : "Subir y procesar"}
            </Button>
          )}
        </div>
      </section>

      {step === "done" && job && (
        <section className="space-y-3 rounded-lg border bg-card p-4" aria-live="polite" aria-label="Resultado de la carga">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill kind={job.state} label={job.state === "ok" ? "Carga correcta" : job.state === "errors" ? "Cargada con errores" : "La carga falló"} />
            <span className="text-xs text-muted-foreground">
              {job.filename ?? file?.name} · {durationLabel(job)}
            </span>
          </div>
          <JobDetail job={job} />
          {job.state === "ok" && <p className="text-xs text-muted-foreground">Los dashboards ya usan estos datos.</p>}
        </section>
      )}
    </div>
  );
}
