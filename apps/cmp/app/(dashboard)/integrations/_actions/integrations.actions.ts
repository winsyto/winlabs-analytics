"use server";

import { auth } from "@/auth";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Create integration ───────────────────────────────────────────────────────

const createSchema = z.object({
  tenantId: z.string().uuid(),
  templateCode: z.string().min(1),
  name: z.string().min(1).max(100),
});

export type CreateIntegrationState = { error?: string; success?: boolean };

export async function createTenantIntegrationAction(
  _prev: CreateIntegrationState,
  formData: FormData
): Promise<CreateIntegrationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  const parsed = createSchema.safeParse({
    tenantId: formData.get("tenantId"),
    templateCode: formData.get("templateCode"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { tenantId, templateCode, name } = parsed.data;

  const template = await prisma.intTemplate.findUnique({
    where: { code: templateCode, isActive: true },
    select: { code: true },
  });
  if (!template) return { error: "Template no encontrado" };

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.intTenantIntegration.create({
        data: {
          tenantId,
          integrationTemplateCode: templateCode,
          name,
          status: "active",
          config: {},
        },
      })
    );

    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    console.error("[createTenantIntegrationAction]", err);
    return { error: "Error al crear la integración." };
  }
}

// ─── Delete integration ───────────────────────────────────────────────────────

const deleteSchema = z.object({
  integrationId: z.coerce.number().int().positive(),
  tenantId: z.string().uuid(),
});

export type DeleteIntegrationState = { error?: string; success?: boolean };

export async function deleteIntegrationAction(
  _prev: DeleteIntegrationState,
  formData: FormData
): Promise<DeleteIntegrationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  const parsed = deleteSchema.safeParse({
    integrationId: formData.get("integrationId"),
    tenantId: formData.get("tenantId"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { integrationId, tenantId } = parsed.data;

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.intTenantIntegration.delete({ where: { id: integrationId } })
    );

    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    console.error("[deleteIntegrationAction]", err);
    return { error: "Error al eliminar la integración." };
  }
}

// ─── Toggle status ────────────────────────────────────────────────────────────

const toggleSchema = z.object({
  integrationId: z.coerce.number().int().positive(),
  tenantId: z.string().uuid(),
  newStatus: z.enum(["active", "paused"]),
});

export type ToggleIntegrationState = { error?: string; success?: boolean };

export async function toggleIntegrationStatusAction(
  _prev: ToggleIntegrationState,
  formData: FormData
): Promise<ToggleIntegrationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  const parsed = toggleSchema.safeParse({
    integrationId: formData.get("integrationId"),
    tenantId: formData.get("tenantId"),
    newStatus: formData.get("newStatus"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const { integrationId, tenantId, newStatus } = parsed.data;

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.intTenantIntegration.update({
        where: { id: integrationId },
        data: { status: newStatus },
      })
    );

    revalidatePath("/integrations");
    revalidatePath(`/integrations/${integrationId}`);
    return { success: true };
  } catch (err) {
    console.error("[toggleIntegrationStatusAction]", err);
    return { error: "Error al actualizar el estado." };
  }
}
