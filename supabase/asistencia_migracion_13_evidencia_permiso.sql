-- ════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 13 · PERMISO PARA SUBIR LA FOTO DE EVIDENCIA
--
-- El portal de marcado funciona SIN login: la persona se identifica con
-- la clave del enlace y su PIN, no con un usuario de Supabase. Por eso su
-- navegador no puede subir al bucket por su cuenta.
--
-- Esta función es el portero: valida exactamente lo mismo que
-- asis_portal_marcar y, si todo cuadra, devuelve la ruta donde debe ir la
-- foto. La edge function asis-evidencia la llama con la llave de servicio
-- y convierte esa ruta en un permiso de subida de un solo uso.
--
-- NO se concede a anon ni a authenticated: solo la edge function puede
-- ejecutarla. Si se expusiera al navegador, cualquiera podría averiguar
-- qué PIN es válido probando de uno en uno.
--
-- Ejecutar TODO el archivo en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.asis_portal_evidencia_permiso(
  p_clave text,
  p_colab bigint,
  p_pin   text,
  p_ext   text default 'webp')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg   public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_k     public.asis_claves;
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg   public.asis_registros;
  v_vent  text;
  v_ext   text;
begin
  -- Misma puerta que la RPC de marcado: clave del enlace…
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  -- …persona activa y PIN correcto
  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k     from public.asis_claves        where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;

  if not public.asis_labora(v_colab, v_hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'no_labora');
  end if;

  -- Si ya marcó hoy, no tiene sentido subir nada
  select * into v_reg from public.asis_registros
   where colaborador_id = v_colab.id and fecha = v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
  end if;

  -- Fuera de su ventana tampoco: así no quedan fotos huérfanas en el bucket
  v_vent := public.asis_ventana(v_colab, v_hoy, v_ahora, v_cfg.tolerancia_min);
  if v_vent in ('antes','cerrada') then
    return jsonb_build_object('ok', false, 'motivo', 'fuera_ventana', 'ventana', v_vent);
  end if;

  v_ext := case when lower(coalesce(p_ext,'')) in ('webp','jpg','jpeg','png')
                then lower(p_ext) else 'webp' end;

  -- Una foto por persona y día: la ruta es siempre la misma, así que un
  -- reintento pisa la anterior en vez de dejar basura acumulada.
  return jsonb_build_object(
    'ok', true,
    'ruta', to_char(v_hoy, 'YYYY/MM') || '/' || v_colab.id || '/' ||
            to_char(v_hoy, 'YYYY-MM-DD') || '.' || v_ext,
    'nombre', v_colab.nombre,
    'servidor_at', now());
end;
$$;

-- Solo la edge function (llave de servicio). Nunca el navegador.
revoke execute on function public.asis_portal_evidencia_permiso(text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.asis_portal_evidencia_permiso(text, bigint, text, text)
  to service_role;

notify pgrst, 'reload schema';

-- ── COMPROBACIÓN ─────────────────────────────────────────────────────
-- Debe devolver 'ok' en false y motivo 'clave' (clave a propósito falsa),
-- lo que confirma que la función existe y responde:
--
--   select public.asis_portal_evidencia_permiso('clave-falsa', 1, '0000');
