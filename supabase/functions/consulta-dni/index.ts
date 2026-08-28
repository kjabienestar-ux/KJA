// @ts-nocheck  — Corre en Deno (Supabase Edge Functions), no en Node.
// El editor local no conoce "Deno", pero en el servidor de Supabase existe y funciona.
// Edge Function: consulta-dni
// Recibe un DNI, consulta decolecta (RENIEC) con el token guardado como secreto
// del servidor, y devuelve el nombre completo. El token NUNCA se expone al navegador.
//
// Desplegar:  supabase functions deploy consulta-dni
// Secreto:    supabase secrets set DECOLECTA_TOKEN=tu_token   (o desde el dashboard)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // El dashboard de asistencia comparte Auth con este proyecto. Validamos la
    // sesión y además que la cuenta pertenezca al equipo de certificados, para
    // proteger la cuota mensual de consultas RENIEC.
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!jwt || !supabaseUrl || !anonKey) return json({ error: "No autorizado" }, 401);
    const usuario = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: identidad, error: eIdentidad } = await usuario.auth.getUser(jwt);
    if (eIdentidad || !identidad?.user) return json({ error: "Sesión inválida" }, 401);
    const { data: esMiembro, error: ePermiso } = await usuario.rpc("cert_es_miembro");
    if (ePermiso) return json({ error: "No se pudo validar el acceso" }, 500);
    if (!esMiembro) return json({ error: "No tienes acceso al módulo de certificados" }, 403);

    const { dni } = await req.json();
    if (!dni || !/^\d{8,15}$/.test(String(dni))) {
      return json({ error: "DNI inválido" }, 400);
    }

    const token = Deno.env.get("DECOLECTA_TOKEN");
    if (!token) return json({ error: "Falta configurar DECOLECTA_TOKEN en el servidor" }, 500);

    const r = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
      headers: { Authorization: `Bearer ${token}`, Referer: "https://decolecta.com" },
    });

    if (!r.ok) return json({ error: "No se encontró ese DNI en RENIEC", status: r.status }, 404);

    const d = await r.json();
    const nombre = [d.first_name, d.first_last_name, d.second_last_name]
      .filter(Boolean).join(" ").trim();

    if (!nombre) return json({ error: "Sin datos para ese DNI" }, 404);
    return json({ nombre, dni: String(dni) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
