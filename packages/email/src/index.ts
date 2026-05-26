export { resend, FROM } from "./client";
export { testEmailHtml } from "./templates/test";
export { resetPasswordEmailHtml } from "./templates/reset-password";

import { resend, FROM } from "./client";

/**
 * Helper principal para enviar emails desde cualquier app.
 *
 * @example
 * await sendEmail({
 *   to: "usuario@empresa.com",
 *   subject: "Bienvenido",
 *   html: "<p>Hola!</p>",
 * });
 */
export async function sendEmail({
  to,
  subject,
  html,
  from = FROM,
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  return resend.emails.send({ from, to, subject, html });
}
