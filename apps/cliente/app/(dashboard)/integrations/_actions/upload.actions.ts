"use server";

import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { prisma } from "@wla/db/client";
import { getUploadPresignedUrl } from "@wla/storage";
import { z } from "zod";

const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls"];
const MAX_FILE_SIZE_MB = 20;

// ── Paso 1: generar URL pre-firmada para subida directa a R2 ─────────────────

const presignSchema = z.object({
  integrationId: z.coerce.number().int().positive(),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSizeBytes: z.coerce.number().int().positive(),
});

export type PresignState = {
  error?: string;
  presignedUrl?: string;
  storagePath?: string;
};

export async function getUploadUrlAction(
  _prev: PresignState,
  formData: FormData
): Promise<PresignState> {
  const session = await auth();
  if (!session) return { error: "No autenticado" };
  const tenantId = session.user.tenantId;

  const parsed = presignSchema.safeParse({
    integrationId: formData.get("integrationId"),
    filename: formData.get("filename"),
    contentType: formData.get("contentType"),
    fileSizeBytes: formData.get("fileSizeBytes"),
  });
  if (!parsed.success) return { error: "Datos de archivo inválidos" };

  const { integrationId, filename, contentType, fileSizeBytes } = parsed.data;

  // Validar extensión
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: `Formato no soportado. Usar: ${ALLOWED_EXTENSIONS.join(", ")}` };
  }

  // Validar tamaño
  if (fileSizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { error: `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB` };
  }

  // Verificar que la integración pertenece al tenant
  const integration = await withTenantContext(tenantId, (tx) =>
    tx.intTenantIntegration.findFirst({
      where: { id: integrationId, tenantId, isActive: true },
      select: { id: true, integrationTemplateCode: true },
    })
  );
  if (!integration) return { error: "Integración no encontrada" };

  // Construir path y generar URL pre-firmada
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${tenantId}/${integrationId}/${ts}_${safeName}`;

  try {
    const presignedUrl = await getUploadPresignedUrl(storagePath, contentType);
    return { presignedUrl, storagePath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[getUploadUrlAction]", msg);
    return { error: `Error al generar URL de subida: ${msg}` };
  }
}

// ── Paso 2: confirmar upload y crear job ──────────────────────────────────────

const confirmSchema = z.object({
  integrationId: z.coerce.number().int().positive(),
  storagePath: z.string().min(1),
  filename: z.string().min(1),
});

export type ConfirmUploadState = {
  error?: string;
  jobId?: number;
};

export async function confirmUploadAction(
  _prev: ConfirmUploadState,
  formData: FormData
): Promise<ConfirmUploadState> {
  const session = await auth();
  if (!session) return { error: "No autenticado" };
  const tenantId = session.user.tenantId;

  const parsed = confirmSchema.safeParse({
    integrationId: formData.get("integrationId"),
    storagePath: formData.get("storagePath"),
    filename: formData.get("filename"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { integrationId, storagePath, filename } = parsed.data;

  // Verificar integración del tenant
  const integration = await withTenantContext(tenantId, (tx) =>
    tx.intTenantIntegration.findFirst({
      where: { id: integrationId, tenantId, isActive: true },
      select: { id: true, integrationTemplateCode: true },
    })
  );
  if (!integration) return { error: "Integración no encontrada" };

  // Mapear integrationTemplateCode (del int_templates) → job_type (del worker)
  const JOB_TYPE_MAP: Record<string, string> = {
    file_people: "file_people",
    file_time: "file_time_attendance",
    file_absenteeism: "file_absenteeism",
    file_payroll: "file_payroll",
  };
  const jobType = JOB_TYPE_MAP[integration.integrationTemplateCode];
  if (!jobType) return { error: `Template ${integration.integrationTemplateCode} no soportado` };

  // Crear job — raw SQL porque jobs no tiene RLS (tabla de plataforma)
  // El worker usa postgres superuser, pero la creación del job la puede hacer
  // el cliente con la conexión normal (sin RLS en jobs = cualquier role puede insertar)
  try {
    const result = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO jobs (tenant_id, integration_id, job_type, status, payload, updated_at)
      VALUES (
        ${tenantId}::uuid,
        ${integrationId},
        ${jobType},
        'pending',
        ${JSON.stringify({ storagePath, filename })}::jsonb,
        now()
      )
      RETURNING id
    `;
    const jobId = result[0]?.id;
    if (!jobId) throw new Error("No se obtuvo ID del job");

    return { jobId };
  } catch (err) {
    console.error("[confirmUploadAction]", err);
    return { error: "Error al crear el job de procesamiento" };
  }
}

// ── Listar integraciones file del tenant ──────────────────────────────────────

export async function getFileIntegrationsAction() {
  const session = await auth();
  if (!session) return [];
  const tenantId = session.user.tenantId;

  return withTenantContext(tenantId, (tx) =>
    tx.intTenantIntegration.findMany({
      where: {
        tenantId,
        isActive: true,
        template: { category: "file" },
      },
      select: {
        id: true,
        name: true,
        integrationTemplateCode: true,
        status: true,
        lastRunAt: true,
        lastSuccessAt: true,
      },
      orderBy: { createdAt: "asc" },
    })
  );
}
