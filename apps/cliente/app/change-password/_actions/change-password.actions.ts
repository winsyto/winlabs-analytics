"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth, signOut } from "@/auth";
import { prisma } from "@wla/db/client";
import { withTenantContext } from "@wla/auth";

const schema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirm"],
});

export type ChangePasswordState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    return { error: "Sesión inválida." };
  }

  const parsed = schema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await withTenantContext(session.user.tenantId, (tx) =>
    tx.user.update({
      where: { id: session.user.id, tenantId: session.user.tenantId },
      data: { passwordHash, mustChangePassword: false },
    })
  );

  await signOut({ redirect: false });

  return { success: true };
}
