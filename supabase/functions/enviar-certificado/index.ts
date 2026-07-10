// @ts-nocheck  — Corre en Deno (Supabase Edge Functions), no en Node.
// Edge Function: enviar-certificado
// Recibe los datos de un certificado + su PDF en base64 y lo envía por correo
// al cliente usando la cuenta de Google Workspace de KJA (SMTP de Gmail).
// La contraseña de aplicación NUNCA se expone al navegador: vive como secreto.
//
// Desplegar:  supabase functions deploy enviar-certificado
// Secretos:   supabase secrets set GMAIL_USER=kjabienestar@escuelakja.net
//             supabase secrets set GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
//             (la contraseña de aplicación de 16 caracteres, sin espacios)

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const VERIFY_BASE = "https://yeiserdev.github.io/KJA/certificado.html";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* Plantilla HTML del correo — estética institucional KJA (tablas + CSS inline
   para compatibilidad con Gmail/Outlook; el degradado es mejora progresiva). */
function htmlCorreo(d: { nombre: string; titulo: string; codigo: string; tipo: string }) {
  const urlVerificar = `${VERIFY_BASE}?id=${encodeURIComponent(d.codigo)}`;
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,30,80,.12);">
  <!-- Cabecera institucional -->
  <tr><td bgcolor="#0b2a5c" style="background:linear-gradient(135deg,#0b2a5c,#08386f 45%,#004fb0);padding:26px 32px;">
    <div style="color:#9db8dd;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">KJA &middot; Registro oficial de certificados</div>
    <div style="color:#ffffff;font-size:22px;font-weight:bold;margin-top:6px;">Tu certificado est&aacute; listo 🎓</div>
  </td></tr>
  <!-- Filo de acento -->
  <tr><td height="3" style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f10075,#ff4da6 40%,#0a63d4);" bgcolor="#f10075">&nbsp;</td></tr>
  <!-- Cuerpo -->
  <tr><td style="padding:30px 32px 10px;">
    <p style="margin:0 0 14px;color:#1e293b;font-size:15px;">Hola <b>${d.nombre}</b>,</p>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
      El Centro de Capacitaci&oacute;n y Formaci&oacute;n Psicol&oacute;gica <b>KJA</b> te hace entrega de tu
      ${d.tipo.toLowerCase()}. Lo encontrar&aacute;s <b>adjunto en PDF</b> a este correo.
    </p>
    <!-- Detalle del certificado -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
      <tr><td style="padding:16px 20px;">
        <div style="color:#94a3b8;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">${d.tipo}</div>
        <div style="color:#0f172a;font-size:16px;font-weight:bold;margin-top:4px;">${d.titulo}</div>
        <div style="color:#64748b;font-size:12px;margin-top:8px;">C&oacute;digo de verificaci&oacute;n:
          <span style="font-family:Courier,monospace;background:#eef2f7;padding:2px 8px;border-radius:5px;color:#334155;font-weight:bold;">${d.codigo}</span>
        </div>
      </td></tr>
    </table>
    <!-- Botón de verificación -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 8px;"><tr>
      <td bgcolor="#004fb0" style="border-radius:9px;">
        <a href="${urlVerificar}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Verificar certificado en l&iacute;nea</a>
      </td>
    </tr></table>
    <p style="margin:8px 0 24px;color:#94a3b8;font-size:12px;text-align:center;line-height:1.5;">
      Cualquier persona puede validar la autenticidad de este documento<br>escaneando su c&oacute;digo QR o desde el enlace de arriba.
    </p>
  </td></tr>
  <!-- Pie -->
  <tr><td height="3" style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f10075,#ff4da6 40%,#0a63d4);" bgcolor="#0a63d4">&nbsp;</td></tr>
  <tr><td bgcolor="#0b2a5c" style="padding:18px 32px;">
    <div style="color:#ffffff;font-size:13px;font-weight:bold;">KJA &middot; Centro de Capacitaci&oacute;n y Formaci&oacute;n Psicol&oacute;gica</div>
    <div style="color:#9db8dd;font-size:12px;margin-top:4px;">Jr. R&iacute;o Amazonas 214, San Luis, Lima &middot; WhatsApp 988 918 238</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Solo un usuario autenticado (admin logueado) puede enviar — no la llave pública anónima.
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1] || ""));
      if (payload.role !== "authenticated") return json({ error: "No autorizado" }, 401);
    } catch { return json({ error: "No autorizado" }, 401); }

    const { para, nombre, titulo, codigo, tipo, pdfBase64, archivo } = await req.json();

    if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(para))) {
      return json({ error: "Correo del destinatario inválido" }, 400);
    }
    if (!nombre || !titulo || !codigo || !pdfBase64) {
      return json({ error: "Faltan datos del certificado" }, 400);
    }
    // ~9 MB de base64 ≈ 6.7 MB de PDF; Gmail acepta hasta 25 MB pero mejor acotar.
    if (String(pdfBase64).length > 9_000_000) {
      return json({ error: "El PDF es demasiado pesado para enviarlo por correo" }, 413);
    }

    const user = Deno.env.get("GMAIL_USER");
    const pass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!user || !pass) {
      return json({ error: "Falta configurar GMAIL_USER / GMAIL_APP_PASSWORD en el servidor" }, 500);
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: user, password: pass },
      },
    });

    try {
      await client.send({
        from: `KJA Centro de Capacitación <${user}>`,
        to: String(para),
        subject: `${tipo || "Certificado"} · ${titulo} — KJA`,
        content: "auto",
        html: htmlCorreo({ nombre: String(nombre), titulo: String(titulo), codigo: String(codigo), tipo: String(tipo || "Certificado") }),
        attachments: [{
          filename: String(archivo || `${codigo}.pdf`).replace(/[^\w.\-]/g, "_"),
          content: String(pdfBase64),
          encoding: "base64",
          contentType: "application/pdf",
        }],
      });
    } finally {
      try { await client.close(); } catch (_) { /* la conexión ya pudo cerrarse */ }
    }

    return json({ ok: true, para: String(para) });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
