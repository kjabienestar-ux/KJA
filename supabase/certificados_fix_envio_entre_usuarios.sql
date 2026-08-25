-- ══════════════════════════════════════════════════════════════════════
--  KJA · Certificados — Fix: permitir a cualquier colaborador registrar
--  el envío de un certificado, sin importar quién lo creó.
--
--  Problema: la RLS de UPDATE en `certificados` restringe la modificación
--  al creador del certificado. Cuando otro colaborador envía el correo,
--  la edge function lo manda bien, pero el UPDATE de `correo_enviado_at`
--  falla silenciosamente y queda como "Sin enviar".
--
--  Solución: una RPC SECURITY DEFINER que se salta la RLS para SOLO
--  escribir la fecha de envío. No abre ningún otro campo a edición.
--
--  Correr en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1) MARCAR CERTIFICADO COMO ENVIADO ──────────────────────────────
--  Solo actualiza correo_enviado_at: no toca nombre, título ni nada más.
CREATE OR REPLACE FUNCTION public.marcar_certificado_enviado(
  p_cert_id uuid,
  p_ahora   timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE certificados
     SET correo_enviado_at = p_ahora
   WHERE id = p_cert_id;
END;
$$;

-- Solo usuarios logueados (nunca la clave anónima)
REVOKE ALL ON FUNCTION public.marcar_certificado_enviado(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.marcar_certificado_enviado(uuid, timestamptz) TO authenticated;


-- ── 2) GUARDAR EMAIL DEL CLIENTE ────────────────────────────────────
--  Mismo problema: si la tabla `clientes` tiene RLS que restringe el
--  UPDATE, el email no se guarda cuando lo envía otro colaborador.
CREATE OR REPLACE FUNCTION public.guardar_email_cliente(
  p_cliente_id uuid,
  p_email      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE clientes
     SET email = p_email
   WHERE id = p_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_email_cliente(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.guardar_email_cliente(uuid, text) TO authenticated;


-- ── 3) PostgREST cachea el esquema ──────────────────────────────────
NOTIFY pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════
--  COMPROBACIÓN (correr después):
--
--  SELECT p.proname, pg_get_function_arguments(p.oid)
--  FROM pg_proc p
--  JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('marcar_certificado_enviado', 'guardar_email_cliente');
--
--  Deben aparecer las dos funciones con sus argumentos.
-- ══════════════════════════════════════════════════════════════════════
