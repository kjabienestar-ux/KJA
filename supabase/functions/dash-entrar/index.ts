// @ts-nocheck — Supabase Edge Functions ejecuta este archivo con Deno.
//
// Edge Function: dash-entrar
// Canjea DNI + PIN por una sesión real de Supabase, con una vigencia de
// negocio máxima de ocho horas. La persona nunca conoce ni administra la
// cuenta técnica que Supabase necesita por debajo.
//
// Requiere dashboard_04_portal_asistencia.sql y DASH_PIN_SECRET.
// Desplegar: supabase functions deploy dash-entrar

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OCHO_HORAS = 8 * 60 * 60 * 1000;
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

const correoDe = (colab: number) => `colab-${colab}@interno.kja`;

async function claveEspejo(colab: number): Promise<string> {
  const secreto = Deno.env.get("DASH_PIN_SECRET");
  if (!secreto) throw new Error("falta_secreto");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`dash:colab:${colab}`),
  );
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionId(accessToken: string): string | null {
  try {
    const parte = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const base64 = parte.padEnd(Math.ceil(parte.length / 4) * 4, "=");
    return JSON.parse(atob(base64)).session_id || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, motivo: "metodo" }, 405);

  try {
    const { dni, pin } = await req.json();
    const dniLimpio = String(dni || "").replace(/\D/g, "");
    const pinLimpio = String(pin || "");
    if (!/^\d{8}$/.test(dniLimpio) || !/^\d{4}$/.test(pinLimpio)) {
      return json({ ok: false, motivo: "credenciales" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) throw new Error("falta_entorno");

    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const sbAuth = createClient(url, anonKey, { auth: { persistSession: false } });

    const { data: entrada, error: eValidar } = await sb.rpc("dash_validar_pin", {
      p_dni: dniLimpio,
      p_pin: pinLimpio,
    });
    if (eValidar) return json({ ok: false, motivo: "servidor" }, 500);
    if (!entrada?.ok) {
      const motivo = entrada?.motivo || "credenciales";
      const estado = motivo === "bloqueado" ? 429 : motivo === "sin_clave" ? 409 : 401;
      return json({ ok: false, motivo, minutos: entrada?.minutos, restantes: entrada?.restantes }, estado);
    }

    const id = Number(entrada.colab);
    const { data: yaTiene, error: eExiste } = await sb
      .from("asis_perfiles")
      .select("id, acceso_panel")
      .eq("colaborador_id", id)
      .maybeSingle();
    if (eExiste) return json({ ok: false, motivo: "servidor" }, 500);
    if (yaTiene?.acceso_panel) return json({ ok: false, motivo: "usa_tu_cuenta" }, 409);

    const correo = correoDe(id);
    const password = await claveEspejo(id);
    let sesion = await sbAuth.auth.signInWithPassword({ email: correo, password });

    if (sesion.error) {
      const { error: eNuevo } = await sb.auth.admin.createUser({
        email: correo,
        password,
        email_confirm: true,
        user_metadata: { colaborador_id: id, origen: "dashboard" },
      });
      if (eNuevo && !String(eNuevo.message || "").toLowerCase().includes("already")) {
        return json({ ok: false, motivo: "no_se_pudo_crear_cuenta" }, 500);
      }
      sesion = await sbAuth.auth.signInWithPassword({ email: correo, password });
      if (sesion.error) return json({ ok: false, motivo: "no_se_pudo_entrar" }, 500);
    }

    const uid = sesion.data.user.id;
    const nombre = String(entrada.nombre || `Colaborador ${id}`);
    if (yaTiene && yaTiene.id !== uid) {
      return json({ ok: false, motivo: "identidad_inconsistente" }, 409);
    }
    const ePerfil = yaTiene
      ? (await sb.from("asis_perfiles").update({ nombre, activo: true }).eq("id", uid)).error
      : (await sb.from("asis_perfiles").upsert({
          id: uid,
          nombre,
          colaborador_id: id,
          acceso_panel: false,
          activo: true,
        }, { onConflict: "id", ignoreDuplicates: true })).error;
    if (ePerfil) return json({ ok: false, motivo: "no_se_pudo_crear_perfil" }, 500);

    const sid = sessionId(sesion.data.session.access_token);
    if (!sid) return json({ ok: false, motivo: "sesion_invalida" }, 500);
    const venceAt = new Date(Date.now() + OCHO_HORAS).toISOString();

    await sb.from("dash_sesiones").delete().eq("perfil_id", uid).lt("vence_at", new Date().toISOString());
    const { error: eSesion } = await sb.from("dash_sesiones").upsert({
      session_id: sid,
      perfil_id: uid,
      vence_at: venceAt,
      revocada_at: null,
    }, { onConflict: "session_id" });
    if (eSesion) return json({ ok: false, motivo: "no_se_pudo_registrar_sesion" }, 500);

    const { data: perfil } = await sb
      .from("asis_perfiles")
      .select("nivel, colaborador_id, asis_colaboradores(area_id, nombre)")
      .eq("id", uid)
      .single();

    return json({
      ok: true,
      access_token: sesion.data.session.access_token,
      refresh_token: sesion.data.session.refresh_token,
      vence_at: venceAt,
      perfil: {
        colab: id,
        nombre: perfil?.asis_colaboradores?.nombre ?? nombre,
        nivel: perfil?.nivel ?? "miembro",
        area: perfil?.asis_colaboradores?.area_id ?? entrada.area ?? null,
      },
    });
  } catch (e) {
    const motivo = String(e?.message) === "falta_secreto" ? "falta_configurar_secreto" : "servidor";
    return json({ ok: false, motivo }, 500);
  }
});
