/** Template HTML para el email de prueba */
export function testEmailHtml(): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email de prueba — WinLabs Analytics</title>
</head>
<body style="font-family: sans-serif; background: #f9fafb; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
    <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px;">
      ✅ El email funciona
    </h1>
    <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
      Este es un email de prueba enviado desde <strong>WinLabs Analytics</strong>
      usando Resend. Si lo estás viendo, la configuración de dominio y API está
      correcta.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px;" />
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      WinLabs Analytics · analytics@winlabs.com.ar
    </p>
  </div>
</body>
</html>
  `.trim();
}
