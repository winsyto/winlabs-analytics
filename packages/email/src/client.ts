import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY no está configurada.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

/** Dirección remitente estándar de wlA */
export const FROM = "WinLabs Analytics <analytics@winlabs.com.ar>";
