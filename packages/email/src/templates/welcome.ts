export function welcomeEmailHtml({
  userName,
  tenantName,
  email,
  tempPassword,
  loginUrl,
}: {
  userName: string;
  tenantName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Bienvenido a ${tenantName}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="margin:0;color:#f8fafc;font-size:18px;font-weight:600;">WinLabs Analytics</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${tenantName}</p>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Hola, ${userName}</h1>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Tu cuenta en <strong>${tenantName}</strong> fue creada. Podés acceder con las siguientes credenciales:
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Tus credenciales</p>
        <p style="margin:0 0 4px;font-size:14px;color:#0f172a;"><strong>Email:</strong> ${email}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#0f172a;"><strong>Contraseña temporal:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
      </div>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400e;">⚠️ Al iniciar sesión por primera vez deberás cambiar tu contraseña.</p>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">Iniciar sesión</a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">Este email fue generado automáticamente. No responder.</p>
    </div>
  </div>
</body>
</html>`;
}
