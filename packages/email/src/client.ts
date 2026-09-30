import { Resend } from "resend";

/** Dirección remitente estándar de wlA */
export const FROM = "WinLabs Analytics <analytics@winlabs.com.ar>";

// Lazy: el cliente se instancia solo cuando se necesita enviar un email.
// Evita que el módulo explote al cargarse en build/SSR sin RESEND_API_KEY.
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY no está configurada.");
    _resend = new Resend(key);
  }
  return _resend;
}
