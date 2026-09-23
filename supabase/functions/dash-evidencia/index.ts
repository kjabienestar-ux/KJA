// @ts-nocheck — Corre en Deno dentro de Supabase Edge Functions.
// Entrega una URL firmada de subida solo a una sesión válida del dashboard.
// La autorización real vive en public.dash_evidencia_permiso().

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
  if (req.method !== "POST") return json({ ok: false, motivo: "metodo" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ ok: false, motivo: "sesion" }, 401);

    const body = await req.json().catch(() => ({ ext: "webp" }));
    const { ext } = body;
    const adminEntry = body.accion === "entrada_direccion";
    if (body.accion && !adminEntry) return json({ ok: false, motivo: "accion" }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ ok: false, motivo: "servidor" }, 500);

    const usuario = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: identidad, error: eIdentidad } = await usuario.auth.getUser(jwt);
    if (eIdentidad || !identidad?.user) return json({ ok: false, motivo: "sesion" }, 401);

    const { data, error } = adminEntry
      ? await usuario.rpc("dash_admin_entrada_permiso", {
        p_colaborador: body.colaborador, p_fecha: body.fecha, p_hora: body.hora,
        p_modalidad: body.modalidad, p_nota: body.nota,
      })
      : await usuario.rpc("dash_evidencia_permiso", { p_ext: String(ext || "webp") });
    if (error) return json({ ok: false, motivo: adminEntry && error.code === "PGRST202" ? "actualizacion" : "error_validacion" }, 500);
    if (!data?.ok) return json({ ok: false, motivo: data?.motivo || "no_autorizado" }, 403);

    const servicio = createClient(url, serviceKey, { auth: { persistSession: false } });
    const ruta = String(data.ruta);
    if (!adminEntry) await servicio.storage.from(BUCKET).remove([ruta]).catch(() => {});
    const { data: firma, error: eFirma } = await servicio.storage.from(BUCKET).createSignedUploadUrl(ruta);
    if (eFirma || !firma) return json({ ok: false, motivo: "sin_permiso_subida" }, 500);

    return json({
      ok: true,
      ruta,
      token: firma.token,
      ...(adminEntry ? { permiso: data.permiso } : {}),
      nombre: data.nombre,
      servidor_at: data.servidor_at,
    });
  } catch {
    return json({ ok: false, motivo: "servidor" }, 500);
  }
});
