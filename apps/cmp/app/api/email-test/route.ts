/**
 * Route de prueba para verificar que Resend está funcionando.
 * Solo accesible con sesión activa (el proxy/middleware protege todas las rutas).
 * ELIMINAR o proteger con feature flag antes de lanzar a producción real.
 *
 * Uso: GET /api/email-test?to=tu@email.com
 */

import { sendEmail, testEmailHtml } from "@wla/email";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") ?? session.user?.email;

  if (!to) {
    return Response.json(
      { error: "Parámetro 'to' requerido (o iniciá sesión)" },
      { status: 400 }
    );
  }

  const { data, error } = await sendEmail({
    to,
    subject: "✅ Email de prueba — WinLabs Analytics",
    html: testEmailHtml(),
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true, id: data?.id, to });
}
