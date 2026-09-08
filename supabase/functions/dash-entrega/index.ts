// @ts-nocheck — Corre en Deno dentro de Supabase Edge Functions.
// Firma una única ruta después de validar sesión, entrada y requisito en SQL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "asis-cierre-evidencias";
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

    const body = await req.json().catch(() => ({}));
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ ok: false, motivo: "servidor" }, 500);

    const usuario = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: identidad, error: identidadError } = await usuario.auth.getUser(jwt);
    if (identidadError || !identidad?.user) return json({ ok: false, motivo: "sesion" }, 401);

    const servicio = createClient(url, serviceKey, { auth: { persistSession: false } });
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await servicio.from("asis_carga_permisos")
      .select("path").is("vinculado_at", null).lt("creado_at", cutoff).limit(100);
    const expiredPaths = (expired || []).map((row: { path: string }) => row.path);
    if (expiredPaths.length) {
      const { error: removeExpiredError } = await servicio.storage.from(BUCKET).remove(expiredPaths);
      if (!removeExpiredError) await servicio.from("asis_carga_permisos").delete().in("path", expiredPaths);
    }

    if (body.accion === "limpiar") {
      const paths = Array.isArray(body.paths) ? [...new Set(body.paths.map(String))].slice(0, 50) : [];
      const { data: colaborador } = await usuario.rpc("dash_colab");
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date());
      const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
      const prefix = `${value("year")}/${value("month")}/${value("day")}/${Number(colaborador)}/`;
      const valid = paths.filter((path) => path.startsWith(prefix)
        && /^[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[0-9]+\/[0-9a-f-]+\.(jpg|webp|mp4|webm)$/.test(path));
      if (!valid.length) return json({ ok: true, eliminados: 0 });
      const { data: linked } = await servicio.from("asis_entrega_archivos").select("path").in("path", valid);
      const linkedPaths = new Set((linked || []).map((row: { path: string }) => row.path));
      const orphaned = valid.filter((path) => !linkedPaths.has(path));
      if (orphaned.length) {
        const { error: removeError } = await servicio.storage.from(BUCKET).remove(orphaned);
        if (!removeError) await servicio.from("asis_carga_permisos").delete().in("path", orphaned);
      }
      return json({ ok: true, eliminados: orphaned.length });
    }

    const isVideo = body.tipo === "video";
    const isReplacement = body.accion === "reemplazar";
    const extension = isVideo && ["mp4", "webm"].includes(String(body.ext || "").toLowerCase())
      ? String(body.ext).toLowerCase() : "jpg";
    const rpc = isReplacement ? "dash_reemplazo_permiso"
      : isVideo ? "dash_video_permiso" : "dash_entrega_permiso";
    const args = isReplacement ? {
      p_requisito: String(body.requisito || ""),
      p_asignacion: body.asignacion == null ? null : Number(body.asignacion),
      p_modalidad: body.modalidad == null ? null : String(body.modalidad),
      p_tipo_archivo: isVideo ? "video" : "imagen",
      p_ext: extension,
    } : isVideo ? {
      p_requisito: String(body.requisito || ""),
      p_asignacion: body.asignacion == null ? null : Number(body.asignacion),
      p_ext: extension,
    } : {
      p_requisito: String(body.requisito || ""),
      p_asignacion: body.asignacion == null ? null : Number(body.asignacion),
      p_modalidad: body.modalidad == null ? null : String(body.modalidad),
      p_ext: "jpg",
    };
    const { data, error } = await usuario.rpc(rpc, args);
    if (error) return json({ ok: false, motivo: "error_validacion" }, 500);
    if (!data?.ok) return json({ ok: false, motivo: data?.motivo || "no_autorizado" }, 403);

    const { data: firma, error: firmaError } = await servicio.storage
      .from(BUCKET)
      .createSignedUploadUrl(String(data.ruta));
    if (firmaError || !firma) {
      await servicio.from("asis_carga_permisos").delete().eq("path", String(data.ruta));
      return json({ ok: false, motivo: "sin_permiso_subida" }, 500);
    }

    return json({
      ok: true,
      ruta: data.ruta,
      token: firma.token,
      servidor_at: data.servidor_at,
    });
  } catch {
    return json({ ok: false, motivo: "servidor" }, 500);
  }
});
