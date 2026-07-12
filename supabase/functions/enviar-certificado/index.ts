// @ts-nocheck  — Corre en Deno (Supabase Edge Functions), no en Node.
// Edge Function: enviar-certificado
// Recibe los datos de un certificado + su PDF en base64 y lo envía por correo
// al cliente usando la cuenta de Google Workspace de KJA (SMTP de Gmail).
// La contraseña de aplicación NUNCA se expone al navegador: vive como secreto.
//
// El mensaje replica el texto formal que el equipo de KJA usa al enviar
// certificados a mano, adaptado según el tipo de documento (taller, curso,
// especialización o constancia).

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const VERIFY_BASE = "https://www.kjadmb.com/certificado.html";

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

// Solo ASCII: para cabeceras del correo (asunto, remitente) — denomailer
// codifica mal las tildes en cabeceras y Gmail muestra el correo corrupto.
function ascii(s: string) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}

/* Redacción según el tipo de documento (el admin envía la etiqueta:
   "Taller" | "Curso" | "Especialización" | "Constancia") */
function textosPorTipo(tipo: string) {
  const t = ascii(tipo).toLowerCase();
  if (t.includes("constancia")) return {
    doc: "Constancia de Taller Presencial",
    docCorto: "Constancia",
    titular: "Entrega de Constancia",
    durante: "durante el taller presencial",
  };
  if (t.includes("especializacion")) return {
    doc: "Certificado de Curso de Especialización",
    docCorto: "Certificado",
    titular: "Entrega de Certificado",
    durante: "durante el programa de especialización",
  };
  if (t.includes("taller")) return {
    doc: "Certificado de Taller",
    docCorto: "Certificado",
    titular: "Entrega de Certificado",
    durante: "durante el taller",
  };
  if (t.includes("curso")) return {
    doc: "Certificado de Curso",
    docCorto: "Certificado",
    titular: "Entrega de Certificado",
    durante: "durante el curso",
  };
  return {
    doc: "Certificado de Estudios",
    docCorto: "Certificado",
    titular: "Entrega de Certificado",
    durante: "durante el programa",
  };
}

/* Plantilla HTML — carta institucional formal (tablas + CSS inline para
   compatibilidad con Gmail/Outlook; los degradados son mejora progresiva). */
function htmlCorreo(d: { nombre: string; titulo: string; codigo: string; tipo: string }) {
  const urlVerificar = `${VERIFY_BASE}?id=${encodeURIComponent(d.codigo)}`;
  const t = textosPorTipo(d.tipo);
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#eef1f6;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 12px 34px rgba(0,20,60,.14);border:1px solid #dfe5ee;">

  <!-- Cabecera institucional con sello -->
  <tr><td bgcolor="#0b2a5c" style="background:linear-gradient(135deg,#0b2a5c,#08386f 45%,#004fb0);padding:34px 40px 30px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="color:#9db8dd;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">KJA &middot; Registro Oficial de Certificados</div>
        <div style="color:#ffffff;font-size:26px;font-weight:bold;margin-top:8px;font-family:Georgia,serif;">${t.titular}</div>
        <div style="color:#c3d3ea;font-size:13px;margin-top:6px;font-family:Arial,Helvetica,sans-serif;">Documento oficial con verificaci&oacute;n en l&iacute;nea</div>
      </td>
      <td width="76" align="right" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td align="center" width="64" height="64" style="width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,.65);box-shadow:0 0 0 4px rgba(255,255,255,.15);color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:17px;letter-spacing:1px;">KJA</td>
        </tr></table>
      </td>
    </tr></table>
  </td></tr>

  <!-- Filo de acento -->
  <tr><td height="3" style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f10075,#ff4da6 40%,#0a63d4);" bgcolor="#f10075">&nbsp;</td></tr>

  <!-- Cuerpo formal -->
  <tr><td style="padding:38px 44px 8px;">
    <p style="margin:0 0 18px;color:#0f172a;font-size:15.5px;line-height:1.7;">Estimado(a) <b>${d.nombre}</b>:</p>

    <p style="margin:0 0 16px;color:#334155;font-size:14.5px;line-height:1.75;">
      Reciba un cordial saludo de parte del equipo de <b>KJA Desarrollando Mi Bienestar</b>.
    </p>
    <p style="margin:0 0 16px;color:#334155;font-size:14.5px;line-height:1.75;">
      Queremos expresar nuestro m&aacute;s sincero agradecimiento por la confianza depositada en nuestra
      instituci&oacute;n y por haber sido parte de este proceso de formaci&oacute;n. Ha sido un placer
      acompa&ntilde;arlo(a) en su aprendizaje y desarrollo.
    </p>
    <p style="margin:0 0 24px;color:#334155;font-size:14.5px;line-height:1.75;">
      Nos complace hacerle entrega de su <b>${t.doc}</b>, el cual se adjunta al presente
      correo en formato PDF como reconocimiento a su participaci&oacute;n y compromiso ${t.durante}.
    </p>

    <!-- Documento emitido -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-left:4px solid #004fb0;border-radius:6px;background:#f8fafc;">
      <tr><td style="padding:20px 24px;">
        <div style="color:#94a3b8;font-size:10.5px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Documento emitido</div>
        <div style="color:#0f172a;font-size:17px;font-weight:bold;margin-top:8px;font-family:Georgia,serif;">${d.titulo}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
          <td style="background:#e8f0fb;color:#004fb0;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;">${d.tipo}</td>
          <td width="10"></td>
          <td style="color:#64748b;font-size:12.5px;font-family:Arial,Helvetica,sans-serif;">C&oacute;digo de verificaci&oacute;n:
            <span style="font-family:Courier,monospace;background:#eef2f7;border:1px solid #dbe3ef;padding:2px 9px;border-radius:4px;color:#0b2a5c;font-weight:bold;">${d.codigo}</span>
          </td>
        </tr></table>
      </td></tr>
    </table>

    <!-- Botón de verificación -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 6px;"><tr>
      <td bgcolor="#004fb0" style="border-radius:6px;">
        <a href="${urlVerificar}" style="display:inline-block;padding:13px 34px;color:#ffffff;font-size:13.5px;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:.4px;">VERIFICAR AUTENTICIDAD EN L&Iacute;NEA</a>
      </td>
    </tr></table>
    <p style="margin:6px 0 26px;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
      Este documento cuenta con c&oacute;digo QR y registro oficial KJA.<br>Cualquier persona puede validar su autenticidad desde el enlace de arriba.
    </p>

    <p style="margin:0 0 16px;color:#334155;font-size:14.5px;line-height:1.75;">
      Le deseamos muchos &eacute;xitos en sus futuros proyectos personales y profesionales. Esperamos tener
      la oportunidad de volver a acompa&ntilde;arlo(a) en pr&oacute;ximas actividades de formaci&oacute;n.
    </p>
    <p style="margin:0 0 26px;color:#334155;font-size:14.5px;line-height:1.75;">Agradecemos nuevamente su preferencia.</p>

    <p style="margin:0 0 2px;color:#0f172a;font-size:14.5px;">Atentamente,</p>
    <p style="margin:0;color:#0b2a5c;font-size:15px;font-weight:bold;">Equipo de KJA Desarrollando Mi Bienestar</p>
    <p style="margin:2px 0 34px;color:#64748b;font-size:12.5px;font-family:Arial,Helvetica,sans-serif;">Centro de Capacitaci&oacute;n y Formaci&oacute;n Psicol&oacute;gica</p>
  </td></tr>

  <!-- Pie -->
  <tr><td height="3" style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f10075,#ff4da6 40%,#0a63d4);" bgcolor="#0a63d4">&nbsp;</td></tr>
  <tr><td bgcolor="#0b2a5c" style="padding:20px 40px;">
    <div style="color:#ffffff;font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">KJA &middot; Desarrollando Mi Bienestar</div>
    <div style="color:#9db8dd;font-size:12px;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">Jr. R&iacute;o Amazonas 214, San Luis, Lima &middot; WhatsApp 988 918 238 &middot; kjabienestar@escuelakja.net</div>
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

    const t = textosPorTipo(String(tipo || ""));
    // ⚠️ Cabeceras solo en ASCII (ver función ascii): tildes aquí corrompen el correo.
    const asunto = ascii(`Entrega de su ${t.doc} - ${titulo} | KJA`).slice(0, 130);

    try {
      await client.send({
        from: `KJA Desarrollando Mi Bienestar <${user}>`,
        to: String(para),
        subject: asunto,
        content: ascii(
          `Estimado(a) ${nombre}: Reciba un cordial saludo del equipo de KJA Desarrollando Mi Bienestar. ` +
          `Nos complace hacerle entrega de su ${t.doc} "${titulo}", adjunto en PDF. ` +
          `Codigo de verificacion: ${codigo}. Verifiquelo en linea: ${VERIFY_BASE}?id=${encodeURIComponent(codigo)}. ` +
          `Atentamente, Equipo de KJA Desarrollando Mi Bienestar.`
        ),
        html: htmlCorreo({ nombre: String(nombre), titulo: String(titulo), codigo: String(codigo), tipo: String(tipo || "Certificado") }),
        attachments: [{
          filename: ascii(String(archivo || `${codigo}.pdf`)).replace(/[^\w.\-]/g, "_"),
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
