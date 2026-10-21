"use server";

import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { ABSENCE_DISPLAYS, ATTENDANCE_MODES, OVERTIME_BASES } from "@wla/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type AttendanceSettingsState = { error?: string; success?: boolean };

const schema = z.object({
  tenantId: z.string().uuid(),
  attendanceMode: z.enum(ATTENDANCE_MODES),
  defaultWorkWeek: z
    .string()
    .regex(/^[01]{7}$/, "La semana laboral debe tener 7 días")
    .refine((w) => w.includes("1"), "La semana laboral debe tener al menos un día laborable"),
  defaultDailyHours: z.number().gt(0, "Las horas diarias deben ser mayores a 0").max(24, "Máximo 24 horas por día"),
  absenceDisplay: z.enum(ABSENCE_DISPLAYS),
  overtimeBase: z.enum(OVERTIME_BASES),
  currency: z.string().regex(/^[A-Z]{3}$/, "La moneda debe ser un código de 3 letras (ej: ARS, USD)"),
});

export async function updateAttendanceSettingsAction(
  input: z.infer<typeof schema>
): Promise<AttendanceSettingsState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { tenantId, ...data } = parsed.data;

  try {
    await withTenantContext(tenantId, (tx) =>
      tx.cfgTenantSetting.upsert({
        where: { tenantId },
        update: data,
        create: { tenantId, ...data },
      })
    );
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateAttendanceSettingsAction]", err);
    return { error: "Error al guardar. Intentá de nuevo." };
  }
}
