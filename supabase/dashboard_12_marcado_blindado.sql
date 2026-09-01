-- =====================================================================
-- KJA · Dashboard 12: marcado blindado y uniforme
--
-- Reglas que ya no dependen del navegador ni de una preferencia:
--   1. Toda marca propia exige una evidencia subida y verificable.
--   2. Solo se marca dentro del horario completo asignado a esa persona.
--   3. El servidor decide fecha, hora, estado y ventana de marcado.
--   4. El dashboard debe presentar el protocolo vigente. Las firmas
--      anteriores se eliminan para que una copia antigua no pueda marcar.
--
-- Ejecutar completo en el SQL Editor de Supabase antes de publicar el
-- dashboard nuevo. No elimina asistencias ni evidencias existentes.
-- =====================================================================

begin;

-- La evidencia deja de ser una opción administrativa.
alter table public.asis_portal_config
  alter column exigir_evidencia set default true;

update public.asis_portal_config
   set exigir_evidencia = true,
       actualizado_at = now()
 where id = 1
   and exigir_evidencia is distinct from true;


-- Un horario incompleto nunca abre una ventana de marcado. Esto evita que
-- una entrada sin salida (o con salida anterior) quede abierta todo el día.
create or replace function public.asis_ventana(
  p_colab public.asis_colaboradores,
  p_fecha date,
  p_hora time,
  p_tol int)
returns text language plpgsql stable set search_path = public as $$
declare
  v_ini  time := public.asis_hora_entrada(p_colab, p_fecha);
  v_fin  time := public.asis_hora_salida(p_colab, p_fecha);
  v_hora time := date_trunc('minute', p_hora)::time;
  v_lim  time;
begin
  if v_ini is null or v_fin is null or v_fin <= v_ini then
    return 'sin_horario';
  end if;

  v_lim := v_ini + make_interval(mins => greatest(coalesce(p_tol, 0), 0));
  if v_hora < v_ini then return 'antes'; end if;
  if v_hora <= v_lim then return 'presente'; end if;
  if v_hora <= v_fin then return 'tardanza'; end if;
  return 'cerrada';
end;
$$;


-- El retrato del día también deja claro si el horario está completo.
create or replace function public.asis_mi_dia(
  p_colab public.asis_colaboradores,
  p_tol int)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg   public.asis_registros;
  v_ini   time := public.asis_hora_entrada(p_colab, v_hoy);
  v_fin   time := public.asis_hora_salida(p_colab, v_hoy);
  v_vent  text := public.asis_ventana(p_colab, v_hoy, v_ahora, p_tol);
  v_sol   public.asis_solicitudes_horario;
  v_completo boolean;
begin
  v_completo := v_ini is not null and v_fin is not null and v_fin > v_ini;

  select * into v_reg
    from public.asis_registros
   where colaborador_id = p_colab.id and fecha = v_hoy;

  select * into v_sol
    from public.asis_solicitudes_horario
   where colaborador_id = p_colab.id and estado = 'pendiente'
   limit 1;

  return jsonb_build_object(
    'id', p_colab.id,
    'nombre', p_colab.nombre,
    'fecha', v_hoy,
    'ahora', v_ahora,
    'labora', public.asis_labora(p_colab, v_hoy),
    'modalidad', coalesce(p_colab.horario_semanal -> extract(isodow from v_hoy)::text ->> 'mod', 'virtual'),
    'hora_entrada', v_ini,
    'hora_salida', v_fin,
    'horario_completo', v_completo,
    'limite', case when v_ini is null then null else v_ini + make_interval(mins => coalesce(p_tol, 15)) end,
    'tolerancia', coalesce(p_tol, 15),
    'ventana', v_vent,
    'puede_marcar', public.asis_labora(p_colab, v_hoy) and v_completo and v_vent in ('presente', 'tardanza'),
    'marcado', v_reg.id is not null,
    'estado', v_reg.estado,
    'marcado_at', v_reg.marcado_at,
    'origen', v_reg.origen,
    'evidencia', coalesce(v_reg.evidencia_path, '') <> '',
    'aviso_horario', case when v_sol.id is null then null else jsonb_build_object(
      'texto', v_sol.horario_nuevo,
      'creado_at', v_sol.creado_at) end);
end;
$$;


-- Prevalidación fresca: se consulta al abrir el modal y periódicamente
-- mientras el dashboard permanece abierto.
create or replace function public.dash_protocolo_marcado(p_protocolo integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_protocolo constant integer := 20260901;
  v_id bigint := public.dash_colab();
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_dia jsonb;
  v_motivo text;
begin
  if p_protocolo is distinct from v_protocolo then
    return jsonb_build_object('ok', false, 'motivo', 'version_antigua', 'protocolo', v_protocolo);
  end if;
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  select * into v_colab from public.asis_colaboradores where id = v_id and activo;
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;

  v_dia := public.asis_mi_dia(v_colab, coalesce(v_cfg.tolerancia_min, 15));
  v_motivo := case
    when coalesce((v_dia ->> 'marcado')::boolean, false) then 'ya_marcado'
    when not coalesce((v_dia ->> 'labora')::boolean, false) then 'no_labora'
    when not coalesce((v_dia ->> 'horario_completo')::boolean, false) then 'horario_incompleto'
    when v_dia ->> 'ventana' not in ('presente', 'tardanza') then 'fuera_ventana'
    else null
  end;

  return jsonb_build_object(
    'ok', true,
    'protocolo', v_protocolo,
    'evidencia_obligatoria', true,
    'puede_marcar', v_motivo is null,
    'motivo', v_motivo,
    'servidor_at', now(),
    'dia', v_dia);
end;
$$;

revoke all on function public.dash_protocolo_marcado(integer) from public, anon;
grant execute on function public.dash_protocolo_marcado(integer) to authenticated;


-- La subida solo se autoriza dentro de una ventana realmente válida.
create or replace function public.dash_evidencia_permiso(p_ext text default 'webp')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id bigint := public.dash_colab();
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_ini time;
  v_fin time;
  v_vent text;
  v_ext text;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  select * into v_colab from public.asis_colaboradores where id = v_id and activo;
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not public.asis_labora(v_colab, v_hoy) then return jsonb_build_object('ok', false, 'motivo', 'no_labora'); end if;
  if exists(select 1 from public.asis_registros where colaborador_id = v_id and fecha = v_hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
  end if;

  v_ini := public.asis_hora_entrada(v_colab, v_hoy);
  v_fin := public.asis_hora_salida(v_colab, v_hoy);
  if v_ini is null or v_fin is null or v_fin <= v_ini then
    return jsonb_build_object('ok', false, 'motivo', 'horario_incompleto');
  end if;

  v_vent := public.asis_ventana(v_colab, v_hoy, v_ahora, coalesce(v_cfg.tolerancia_min, 15));
  if v_vent not in ('presente', 'tardanza') then
    return jsonb_build_object('ok', false, 'motivo', 'fuera_ventana', 'ventana', v_vent);
  end if;

  v_ext := case when lower(coalesce(p_ext, '')) in ('webp', 'jpg', 'jpeg')
                then lower(p_ext) else 'webp' end;
  return jsonb_build_object(
    'ok', true,
    'ruta', to_char(v_hoy, 'YYYY/MM') || '/' || v_id || '/' || to_char(v_hoy, 'YYYY-MM-DD') || '.' || v_ext,
    'nombre', v_colab.nombre,
    'servidor_at', now());
end;
$$;

revoke all on function public.dash_evidencia_permiso(text) from public, anon;
grant execute on function public.dash_evidencia_permiso(text) to authenticated;


-- Se elimina la firma anterior: una copia antigua del dashboard no puede
-- registrar hasta recargarse y adoptar el protocolo nuevo.
drop function if exists public.dash_marcar(text, text, text, numeric, numeric);

create or replace function public.dash_marcar_seguro(
  p_protocolo integer,
  p_disp text,
  p_foto text,
  p_foto_org text,
  p_lat numeric,
  p_lon numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_protocolo constant integer := 20260901;
  v_id bigint := public.dash_colab();
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_ini time;
  v_fin time;
  v_vent text;
  v_estado text;
  v_prefijo text;
  v_reg public.asis_registros;
  v_objeto boolean;
begin
  if p_protocolo is distinct from v_protocolo then
    return jsonb_build_object('ok', false, 'motivo', 'version_antigua', 'protocolo', v_protocolo);
  end if;
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  select * into v_colab from public.asis_colaboradores where id = v_id and activo;
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if not public.asis_labora(v_colab, v_hoy) then return jsonb_build_object('ok', false, 'motivo', 'no_labora'); end if;

  select * into v_reg from public.asis_registros where colaborador_id = v_id and fecha = v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado', 'estado', v_reg.estado, 'marcado_at', v_reg.marcado_at);
  end if;

  v_ini := public.asis_hora_entrada(v_colab, v_hoy);
  v_fin := public.asis_hora_salida(v_colab, v_hoy);
  if v_ini is null or v_fin is null or v_fin <= v_ini then
    return jsonb_build_object('ok', false, 'motivo', 'horario_incompleto');
  end if;

  v_vent := public.asis_ventana(v_colab, v_hoy, v_ahora, coalesce(v_cfg.tolerancia_min, 15));
  if v_vent not in ('presente', 'tardanza') then
    return jsonb_build_object('ok', false, 'motivo', 'fuera_ventana', 'ventana', v_vent,
      'dia', public.asis_mi_dia(v_colab, coalesce(v_cfg.tolerancia_min, 15)));
  end if;

  if coalesce(btrim(p_foto), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'falta_evidencia');
  end if;
  if p_foto_org is null or p_foto_org not in ('camara', 'archivo') then
    return jsonb_build_object('ok', false, 'motivo', 'evidencia_invalida');
  end if;
  if (p_lat is not null and (p_lat < -90 or p_lat > 90))
     or (p_lon is not null and (p_lon < -180 or p_lon > 180)) then
    return jsonb_build_object('ok', false, 'motivo', 'ubicacion_invalida');
  end if;

  v_prefijo := to_char(v_hoy, 'YYYY/MM') || '/' || v_id || '/' || to_char(v_hoy, 'YYYY-MM-DD') || '.';
  if btrim(p_foto) not in (v_prefijo || 'webp', v_prefijo || 'jpg', v_prefijo || 'jpeg') then
    return jsonb_build_object('ok', false, 'motivo', 'evidencia_invalida');
  end if;

  select exists(
    select 1
      from storage.objects o
     where o.bucket_id = 'asis-evidencias'
       and o.name = btrim(p_foto)
       and coalesce(o.updated_at, o.created_at) >= now() - interval '30 minutes'
  ) into v_objeto;
  if not v_objeto then
    return jsonb_build_object('ok', false, 'motivo', 'evidencia_no_verificada');
  end if;

  v_estado := case when v_vent = 'tardanza' then 'T' else 'P' end;
  insert into public.asis_registros
    (colaborador_id, fecha, estado, origen, dispositivo, marcado_por, horas, vinculo,
     evidencia_path, evidencia_origen, evidencia_lat, evidencia_lon, evidencia_at)
  values
    (v_id, v_hoy, v_estado, 'dashboard', left(coalesce(p_disp, ''), 80), auth.uid(),
     public.asis_horas_dia(v_colab, v_hoy), public.asis_vinc_dia(v_colab, v_hoy),
     btrim(p_foto), p_foto_org, p_lat, p_lon, now());

  return jsonb_build_object(
    'ok', true,
    'protocolo', v_protocolo,
    'estado', v_estado,
    'hora', v_ahora,
    'dia', public.asis_mi_dia(v_colab, coalesce(v_cfg.tolerancia_min, 15)));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
end;
$$;

revoke all on function public.dash_marcar_seguro(integer, text, text, text, numeric, numeric) from public, anon;
grant execute on function public.dash_marcar_seguro(integer, text, text, text, numeric, numeric) to authenticated;


-- La vía anterior sin sesión queda endurecida también. Sigue disponible para
-- activaciones antiguas, pero jamás sin foto ni fuera de un horario completo.
drop function if exists public.asis_portal_marcar(text, bigint, text, text);

create or replace function public.asis_portal_marcar(
  p_clave text,
  p_colab bigint,
  p_pin text,
  p_disp text,
  p_foto text default null,
  p_foto_org text default null,
  p_lat numeric default null,
  p_lon numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_k public.asis_claves;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_ini time;
  v_fin time;
  v_vent text;
  v_estado text;
  v_prefijo text;
  v_reg public.asis_registros;
  v_objeto boolean;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k from public.asis_claves where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;
  if not public.asis_labora(v_colab, v_hoy) then return jsonb_build_object('ok', false, 'motivo', 'no_labora'); end if;

  select * into v_reg from public.asis_registros where colaborador_id = v_colab.id and fecha = v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado', 'estado', v_reg.estado, 'marcado_at', v_reg.marcado_at);
  end if;

  v_ini := public.asis_hora_entrada(v_colab, v_hoy);
  v_fin := public.asis_hora_salida(v_colab, v_hoy);
  if v_ini is null or v_fin is null or v_fin <= v_ini then
    return jsonb_build_object('ok', false, 'motivo', 'horario_incompleto');
  end if;
  v_vent := public.asis_ventana(v_colab, v_hoy, v_ahora, coalesce(v_cfg.tolerancia_min, 15));
  if v_vent not in ('presente', 'tardanza') then
    return jsonb_build_object('ok', false, 'motivo', 'fuera_ventana', 'ventana', v_vent);
  end if;

  if coalesce(btrim(p_foto), '') = '' then return jsonb_build_object('ok', false, 'motivo', 'falta_evidencia'); end if;
  if p_foto_org is null or p_foto_org not in ('camara', 'archivo') then return jsonb_build_object('ok', false, 'motivo', 'evidencia_invalida'); end if;
  v_prefijo := to_char(v_hoy, 'YYYY/MM') || '/' || v_colab.id || '/' || to_char(v_hoy, 'YYYY-MM-DD') || '.';
  if btrim(p_foto) not in (v_prefijo || 'webp', v_prefijo || 'jpg', v_prefijo || 'jpeg', v_prefijo || 'png') then
    return jsonb_build_object('ok', false, 'motivo', 'evidencia_invalida');
  end if;

  select exists(
    select 1 from storage.objects o
     where o.bucket_id = 'asis-evidencias'
       and o.name = btrim(p_foto)
       and coalesce(o.updated_at, o.created_at) >= now() - interval '30 minutes'
  ) into v_objeto;
  if not v_objeto then return jsonb_build_object('ok', false, 'motivo', 'evidencia_no_verificada'); end if;

  v_estado := case when v_vent = 'tardanza' then 'T' else 'P' end;
  insert into public.asis_registros
    (colaborador_id, fecha, estado, origen, dispositivo, horas, vinculo,
     evidencia_path, evidencia_origen, evidencia_lat, evidencia_lon, evidencia_at)
  values
    (v_colab.id, v_hoy, v_estado, 'portal', left(coalesce(p_disp, ''), 80),
     public.asis_horas_dia(v_colab, v_hoy), public.asis_vinc_dia(v_colab, v_hoy),
     btrim(p_foto), p_foto_org, p_lat, p_lon, now());

  return jsonb_build_object('ok', true, 'estado', v_estado, 'hora', v_ahora,
    'dia', public.asis_mi_dia(v_colab, coalesce(v_cfg.tolerancia_min, 15)));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
end;
$$;

revoke all on function public.asis_portal_marcar(text, bigint, text, text, text, text, numeric, numeric) from public;
grant execute on function public.asis_portal_marcar(text, bigint, text, text, text, text, numeric, numeric) to anon, authenticated;


create or replace function public.asis_portal_evidencia_permiso(
  p_clave text,
  p_colab bigint,
  p_pin text,
  p_ext text default 'webp')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_k public.asis_claves;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_ini time;
  v_fin time;
  v_vent text;
  v_ext text;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;
  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k from public.asis_claves where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;
  if not public.asis_labora(v_colab, v_hoy) then return jsonb_build_object('ok', false, 'motivo', 'no_labora'); end if;
  if exists(select 1 from public.asis_registros where colaborador_id = v_colab.id and fecha = v_hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
  end if;

  v_ini := public.asis_hora_entrada(v_colab, v_hoy);
  v_fin := public.asis_hora_salida(v_colab, v_hoy);
  if v_ini is null or v_fin is null or v_fin <= v_ini then
    return jsonb_build_object('ok', false, 'motivo', 'horario_incompleto');
  end if;
  v_vent := public.asis_ventana(v_colab, v_hoy, v_ahora, coalesce(v_cfg.tolerancia_min, 15));
  if v_vent not in ('presente', 'tardanza') then
    return jsonb_build_object('ok', false, 'motivo', 'fuera_ventana', 'ventana', v_vent);
  end if;

  v_ext := case when lower(coalesce(p_ext, '')) in ('webp', 'jpg', 'jpeg', 'png')
                then lower(p_ext) else 'webp' end;
  return jsonb_build_object(
    'ok', true,
    'ruta', to_char(v_hoy, 'YYYY/MM') || '/' || v_colab.id || '/' || to_char(v_hoy, 'YYYY-MM-DD') || '.' || v_ext,
    'nombre', v_colab.nombre,
    'servidor_at', now());
end;
$$;

revoke execute on function public.asis_portal_evidencia_permiso(text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.asis_portal_evidencia_permiso(text, bigint, text, text)
  to service_role;


-- Mantiene la firma administrativa por compatibilidad, pero el tercer valor
-- ya no puede apagar la política global.
create or replace function public.dash_admin_guardar_portal(
  p_tolerancia integer,
  p_activo boolean,
  p_exigir_evidencia boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_antes public.asis_portal_config;
  v_despues public.asis_portal_config;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_tolerancia is null or p_tolerancia not between 0 and 120 or p_activo is null then
    return jsonb_build_object('ok', false, 'motivo', 'configuracion');
  end if;

  select * into v_antes from public.asis_portal_config where id = 1 for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'sin_configuracion'); end if;

  update public.asis_portal_config
     set tolerancia_min = p_tolerancia,
         activo = p_activo,
         exigir_evidencia = true,
         actualizado_at = now()
   where id = 1
   returning * into v_despues;

  insert into public.asis_admin_eventos(actor_id, accion, detalle)
  values(auth.uid(), 'config_portal', jsonb_build_object(
    'antes', jsonb_build_object(
      'tolerancia_min', v_antes.tolerancia_min,
      'activo', v_antes.activo,
      'exigir_evidencia', coalesce(v_antes.exigir_evidencia, false)),
    'despues', jsonb_build_object(
      'tolerancia_min', v_despues.tolerancia_min,
      'activo', v_despues.activo,
      'exigir_evidencia', true)));

  return jsonb_build_object('ok', true, 'config', jsonb_build_object(
    'tolerancia_min', v_despues.tolerancia_min,
    'activo', v_despues.activo,
    'exigir_evidencia', true,
    'actualizado_at', v_despues.actualizado_at));
end;
$$;

revoke all on function public.dash_admin_guardar_portal(integer, boolean, boolean) from public, anon;
grant execute on function public.dash_admin_guardar_portal(integer, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;


-- COMPROBACIÓN: todas las filas deben mostrar OK.
select estado, pieza, encontrado, esperado
from (
  select case when (select exigir_evidencia from public.asis_portal_config where id = 1)
              then 'OK' else 'REVISAR' end as estado,
         'evidencia obligatoria'::text as pieza, 1 as encontrado, 1 as esperado
  union all
  select case when to_regprocedure('public.dash_protocolo_marcado(integer)') is not null
                and to_regprocedure('public.dash_marcar_seguro(integer,text,text,text,numeric,numeric)') is not null
              then 'OK' else 'REVISAR' end,
         'protocolo seguro', 2, 2
  union all
  select case when to_regprocedure('public.dash_marcar(text,text,text,numeric,numeric)') is null
                and to_regprocedure('public.asis_portal_marcar(text,bigint,text,text)') is null
              then 'OK' else 'REVISAR' end,
         'firmas antiguas anuladas', 2, 2
  union all
  select case when to_regprocedure('public.dash_evidencia_permiso(text)') is not null
                and to_regprocedure('public.asis_portal_evidencia_permiso(text,bigint,text,text)') is not null
              then 'OK' else 'REVISAR' end,
         'permisos de evidencia', 2, 2
) comprobacion;
