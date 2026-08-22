// @ts-nocheck  — Corre en Deno (Supabase Edge Functions), no en Node.
// El editor local no conoce "Deno", pero en el servidor de Supabase existe y funciona.
//
// Edge Function: asis-evidencia
// Portero para subir la foto de evidencia al marcar asistencia.
//
// El portal de marcado funciona sin login, así que el navegador no tiene
// permiso para escribir en el bucket. Aquí se valida la clave del enlace y
// el PIN de la persona (mismas reglas que asis_portal_marcar) y, si todo
// cuadra, se devuelve un permiso de subida de UN SOLO USO para una ruta
// concreta. Sin PIN válido no se entrega nada.
//
// Devuelve: { ok, ruta, token, servidor_at }
//   · ruta        → dónde va el archivo dentro del bucket
//   · token       → se usa con uploadToSignedUrl(ruta, token, archivo)
//   · servidor_at → hora real del servidor, para estampar la foto
//                   (el reloj del celular se puede cambiar; este no)
//
// Desplegar:  supabase functions deploy asis-evidencia
// No necesita secretos: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los
// inyecta Supabase sola.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "asis-evidencias";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { clave, colab, pin, ext } = await req.json();

    if (!clave || !colab || !pin) {
      return json({ ok: false, motivo: "faltan_datos" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    // La validación vive en SQL, junto a las demás reglas de asistencia
    const { data, error } = await sb.rpc("asis_portal_evidencia_permiso", {
      p_clave: String(clave),
      p_colab: Number(colab),
      p_pin: String(pin),
      p_ext: String(ext || "webp"),
    });

    if (error) return json({ ok: false, motivo: "error_validacion" }, 500);
    if (!data || !data.ok) {
      // 403 y sin detalles de más: no se le dice a nadie por qué falló el PIN
      return json({ ok: false, motivo: data?.motivo || "no_autorizado" }, 403);
    }

    const ruta: string = data.ruta;

    // Un reintento del mismo día debe pisar la foto anterior, no acumular.
    // Si no existía, esto no falla ni pasa nada.
    await sb.storage.from(BUCKET).remove([ruta]).catch(() => {});

    const { data: firma, error: e2 } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(ruta);

    if (e2 || !firma) return json({ ok: false, motivo: "sin_permiso_subida" }, 500);

    return json({
      ok: true,
      ruta,
      token: firma.token,
      nombre: data.nombre,
      servidor_at: data.servidor_at,
    });
  } catch (e) {
    return json({ ok: false, motivo: "error", detalle: String(e) }, 500);
  }
});
