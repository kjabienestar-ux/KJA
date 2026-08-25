// @ts-nocheck  — Corre en Deno (Supabase Edge Functions), no en Node.
// El editor local no conoce "Deno", pero en el servidor de Supabase existe.
//
// Edge Function: dash-entrar
// Canjea la clave del portal de marcado por una sesión real de Supabase.
//
// POR QUÉ HACE FALTA
// El portal de marcado no tiene login: es anónimo y todo pasa por RPC con
// una clave compartida en el enlace. Eso alcanza para marcar asistencia,
// pero el dashboard necesita RLS de verdad — "veo lo mío, mi líder ve su
// área" solo se puede sostener si la base sabe QUIÉN está preguntando, y
// eso es auth.uid(). Así que aquí se verifica el PIN y, si es correcto, se
// entrega una sesión firmada por Supabase. A partir de ahí el dashboard es
// una app normal con sesión, caducidad y RLS.
//
// CÓMO SE VERIFICA EL PIN
// No se reimplementa nada: se llama a asis_portal_entrar, la misma función
// que usa el portal. Así el bloqueo por intentos fallidos vive en un solo
// sitio y no puede quedar desincronizado entre las dos puertas.
//
// LA CUENTA ESPEJO
// Cada colaborador tiene un usuario de auth creado la primera vez que entra.
// Su correo es interno y no recibe nada; su contraseña se deriva de un
// secreto del servidor y nunca sale de aquí ni se guarda en ninguna tabla.
// Nadie —tampoco la persona— la conoce ni la necesita: se entra con el PIN.
//
// Devuelve: { ok, access_token, refresh_token, perfil:{ colab, nombre, nivel, area } }
// Motivos de rechazo propios: 'usa_tu_cuenta' (ya tiene cuenta con correo)
//
// Desplegar:  supabase functions deploy dash-entrar
// Secreto que hay que poner una vez:
//   supabase secrets set DASH_PIN_SECRET="<cadena larga y aleatoria>"
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase sola.

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

/* Correo interno: no existe, no recibe nada y no se le escribe nunca. Solo
   sirve porque Supabase Auth necesita una identidad con formato de correo. */
const correoDe = (colab: number) => `colab-${colab}@interno.kja`;

/* La contraseña sale de un secreto del servidor y del id, así que es
   siempre la misma para esa persona sin necesidad de guardarla en ninguna
   parte. Si el secreto se cambiara, habría que reiniciar las contraseñas:
   por eso se pone una vez y no se rota a la ligera. */
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { clave, colab, pin } = await req.json();
    if (!clave || !colab || !pin) return json({ ok: false, motivo: "faltan_datos" }, 400);

    const id = Number(colab);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, motivo: "faltan_datos" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    // ── 1) El PIN, con las mismas reglas y el mismo bloqueo que el portal ──
    const { data: entrada, error: eRpc } = await sb.rpc("asis_portal_entrar", {
      p_clave: String(clave),
      p_colab: id,
      p_pin: String(pin),
    });
    if (eRpc) return json({ ok: false, motivo: "servidor" }, 500);
    if (!entrada || !entrada.ok) {
      // Se devuelve tal cual: 'clave', 'incorrecta', 'bloqueado', 'sin_clave'…
      // El dashboard muestra el mismo mensaje que el portal de marcado.
      return json({ ok: false, ...entrada }, 401);
    }

    // ── 2) ¿Ya tiene cuenta del panel? ──
    //  La única cuenta de asis_perfiles hoy es la de dirección. Si esa
    //  persona entrara por aquí se le crearía una segunda identidad, y el
    //  índice único de colaborador_id lo rechazaría con un error opaco.
    //  Mejor decirlo claro: quien tiene cuenta con correo, entra con ella.
    const { data: yaTiene } = await sb
      .from("asis_perfiles")
      .select("id, acceso_panel")
      .eq("colaborador_id", id)
      .maybeSingle();

    if (yaTiene?.acceso_panel) {
      return json({ ok: false, motivo: "usa_tu_cuenta" }, 409);
    }

    // ── 3) La cuenta espejo, creada la primera vez ──
    const correo = correoDe(id);
    const password = await claveEspejo(id);

    /* El inicio de sesión va con la clave pública, no con la de servicio:
       es una autenticación normal y no tiene por qué llevar privilegios. */
    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"),
      { auth: { persistSession: false } },
    );

    let sesion = await sbAuth.auth.signInWithPassword({ email: correo, password });

    if (sesion.error) {
      // Todavía no existe: se crea y se vuelve a entrar. email_confirm evita
      // que Supabase intente mandar un correo a una dirección que no existe.
      const { error: eNuevo } = await sb.auth.admin.createUser({
        email: correo,
        password,
        email_confirm: true,
        user_metadata: { colaborador_id: id, origen: "dashboard" },
      });
      // Si dos pestañas entran a la vez, una de las dos ve "ya existe": no es
      // un error, basta con reintentar el inicio de sesión.
      if (eNuevo && !String(eNuevo.message || "").toLowerCase().includes("already")) {
        return json({ ok: false, motivo: "no_se_pudo_crear_cuenta" }, 500);
      }
      sesion = await sbAuth.auth.signInWithPassword({ email: correo, password });
      if (sesion.error) return json({ ok: false, motivo: "no_se_pudo_entrar" }, 500);
    }

    const uid = sesion.data.user.id;

    // ── 4) El perfil, enlazado a su colaborador ──
    //  Insertar y actualizar se hacen por separado a propósito. Un upsert
    //  reescribiría acceso_panel y nivel en CADA entrada, así que a un
    //  líder técnico se le quitaría el cargo la próxima vez que entrara.
    //  Al actualizar solo se refresca el nombre.
    const nombre = entrada.dia?.nombre ?? `Colaborador ${id}`;
    const ePerfil = yaTiene
      ? (await sb.from("asis_perfiles").update({ nombre, activo: true }).eq("id", uid)).error
      : (await sb.from("asis_perfiles").insert({
          id: uid,
          nombre,
          colaborador_id: id,
          acceso_panel: false,   // cuenta del dashboard, no del panel
          activo: true,
        })).error;
    if (ePerfil) return json({ ok: false, motivo: "no_se_pudo_crear_perfil" }, 500);

    // El nivel se lee al final: ni el insert ni el update lo envían, así que
    // aquí sale el valor real de quien ya fuera líder técnico.
    const { data: perfil } = await sb
      .from("asis_perfiles")
      .select("nivel, colaborador_id, asis_colaboradores(area_id, nombre)")
      .eq("id", uid)
      .single();

    return json({
      ok: true,
      access_token: sesion.data.session.access_token,
      refresh_token: sesion.data.session.refresh_token,
      perfil: {
        colab: id,
        nombre: perfil?.asis_colaboradores?.nombre ?? null,
        nivel: perfil?.nivel ?? "miembro",
        area: perfil?.asis_colaboradores?.area_id ?? null,
      },
    });
  } catch (e) {
    if (String(e?.message) === "falta_secreto") {
      return json({ ok: false, motivo: "falta_configurar_secreto" }, 500);
    }
    return json({ ok: false, motivo: "servidor" }, 500);
  }
});
