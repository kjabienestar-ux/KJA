-- =====================================================================
-- KJA · Dashboard — Fase 3: Colaboradores y contratos
--
-- REQUIERE
--   · migraciones de asistencia 1–14
--   · dashboard_01, dashboard_03, dashboard_04 y dashboard_05
--
-- AÑADE
--   · consulta administrativa de colaboradores, PIN y contratos;
--   · alta/edición y baja lógica con validaciones en el servidor;
--   · creación controlada de áreas;
--   · resumen contractual y bitácora atómica de cambios.
--
-- NO MODIFICA FILAS EXISTENTES al ejecutar esta migración.
-- =====================================================================

begin;

-- 1) HORAS DE UNA SEMANA TÍPICA --------------------------------------
create or replace function public.dash_admin_horas_semana(
  p_colab public.asis_colaboradores,
  p_vinculo text default null
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_dow int;
  v_dia jsonb;
  v_mod text;
  v_vinc text;
  v_ini time;
  v_fin time;
  v_total numeric := 0;
begin
  for v_dow in 1..7 loop
    v_dia := coalesce(p_colab.horario_semanal -> v_dow::text,'{}'::jsonb);
    v_mod := coalesce(
      nullif(v_dia->>'mod',''),
      case when v_dow=any(p_colab.dias_laborables) then 'virtual' else 'no_gestiona' end
    );
    if v_mod='no_gestiona' then continue; end if;

    v_vinc := case
      when p_colab.tipo_vinculo='ambos'
        then coalesce(nullif(v_dia->>'vinc',''),'practicas')
      when p_colab.tipo_vinculo='voluntariado' then 'voluntariado'
      else 'practicas'
    end;
    if p_vinculo is not null and v_vinc<>p_vinculo then continue; end if;

    v_ini := coalesce(nullif(v_dia->>'ini','')::time,p_colab.hora_inicio);
    v_fin := coalesce(nullif(v_dia->>'fin','')::time,p_colab.hora_fin);
    if v_ini is not null and v_fin is not null and v_fin>v_ini then
      v_total := v_total + extract(epoch from (v_fin-v_ini))/3600.0;
    end if;
  end loop;
  return round(v_total,2);
end;
$$;

revoke all on function public.dash_admin_horas_semana(public.asis_colaboradores,text)
  from public,anon,authenticated;


-- 2) RESUMEN CONTRACTUAL ÚNICO ---------------------------------------
create or replace function public.dash_admin_resumen_contrato(
  p_colab public.asis_colaboradores
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_mixto boolean := p_colab.tipo_vinculo='ambos';
  v_marcadas numeric := 0;
  v_vol_marcadas numeric := 0;
  v_cumplidas numeric := coalesce(p_colab.horas_previas,0);
  v_meta numeric := p_colab.contrato_horas;
  v_semana numeric;
  v_faltantes numeric;
  v_fin date;
  v_vol_meta numeric := p_colab.contrato_horas_voluntariado;
  v_vol_semana numeric := 0;
  v_vol_faltantes numeric;
  v_vol_fin date;
  v_alertas text[] := array[]::text[];
begin
  select
    coalesce(sum(r.horas) filter (
      where not v_mixto or coalesce(r.vinculo,public.asis_vinc_dia(p_colab,r.fecha))='practicas'
    ),0),
    coalesce(sum(r.horas) filter (
      where v_mixto and coalesce(r.vinculo,public.asis_vinc_dia(p_colab,r.fecha))='voluntariado'
    ),0)
  into v_marcadas,v_vol_marcadas
  from public.asis_registros r
  where r.colaborador_id=p_colab.id
    and r.estado in ('P','T','J') and r.horas is not null;

  v_cumplidas := v_cumplidas + v_marcadas;
  v_semana := public.dash_admin_horas_semana(
    p_colab,case when v_mixto then 'practicas' else null end);
  if v_meta is not null and v_meta>0 then
    v_faltantes := greatest(0,v_meta-v_cumplidas);
    if v_faltantes>0 and v_semana>0 then
      v_fin := v_hoy + ceil(v_faltantes/v_semana*7)::int;
    end if;
  end if;

  if not coalesce(p_colab.contrato_pendiente,false) then
    if v_meta is null or v_meta<=0 then v_alertas:=array_append(v_alertas,'Sin horas de contrato definidas'); end if;
    if p_colab.contrato_inicio is null then v_alertas:=array_append(v_alertas,'Sin fecha de inicio de contrato'); end if;
    if v_semana<=0 then v_alertas:=array_append(v_alertas,'Sin horario activo esta semana'); end if;
    if v_meta is not null and v_cumplidas>v_meta then v_alertas:=array_append(v_alertas,'Superó las horas de contrato'); end if;
    if p_colab.contrato_fin_referencia is not null and p_colab.contrato_fin_referencia<v_hoy
       and coalesce(v_faltantes,0)>0 then
      v_alertas:=array_append(v_alertas,'Venció la fecha del contrato y aún faltan horas');
    end if;
  end if;

  if v_mixto then
    v_vol_semana := public.dash_admin_horas_semana(p_colab,'voluntariado');
    if v_vol_meta is not null and v_vol_meta>0 then
      v_vol_faltantes := greatest(0,v_vol_meta-v_vol_marcadas);
      if v_vol_faltantes>0 and v_vol_semana>0 then
        v_vol_fin := v_hoy + ceil(v_vol_faltantes/v_vol_semana*7)::int;
      end if;
    end if;
    if not coalesce(p_colab.contrato_pendiente,false) then
      if v_vol_semana<=0 then v_alertas:=array_append(v_alertas,'Sin días de voluntariado'); end if;
      if v_vol_meta is null or v_vol_meta<=0 then v_alertas:=array_append(v_alertas,'Sin meta de voluntariado'); end if;
      if v_vol_meta is not null and v_vol_marcadas>v_vol_meta then
        v_alertas:=array_append(v_alertas,'Superó las horas de voluntariado');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'cumplidas',round(v_cumplidas,2),'marcadas',round(v_marcadas,2),
    'previas',coalesce(p_colab.horas_previas,0),'meta',v_meta,
    'faltantes',v_faltantes,'semana_horas',v_semana,
    'completado',coalesce(v_meta>0 and v_cumplidas>=v_meta,false),
    'fecha_fin_estimada',v_fin,'pendiente',coalesce(p_colab.contrato_pendiente,false),
    'nota',p_colab.contrato_nota,'alertas',to_jsonb(v_alertas),
    'voluntariado',case when v_mixto then jsonb_build_object(
      'cumplidas',round(v_vol_marcadas,2),'meta',v_vol_meta,
      'faltantes',v_vol_faltantes,'semana_horas',v_vol_semana,
      'completado',coalesce(v_vol_meta>0 and v_vol_marcadas>=v_vol_meta,false),
      'fecha_fin_estimada',v_vol_fin) else null end
  );
end;
$$;

revoke all on function public.dash_admin_resumen_contrato(public.asis_colaboradores)
  from public,anon,authenticated;


-- 3) CARGA DE COLABORADORES Y CONTRATOS ------------------------------
create or replace function public.dash_admin_equipo(
  p_incluir_inactivos boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_areas jsonb;
  v_personas jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id',a.id,'nombre',a.nombre,'orden',a.orden,'activo',a.activo
  ) order by a.orden,a.nombre) into v_areas
  from public.asis_areas a;

  select jsonb_agg(jsonb_build_object(
    'id',c.id,'area_id',c.area_id,'area',a.nombre,'nombre',c.nombre,'dni',c.dni,
    'activo',c.activo,'orden',c.orden,'tiene_pin',exists(
      select 1 from public.asis_claves k where k.colaborador_id=c.id),
    'tiene_cuenta',exists(
      select 1 from public.asis_perfiles p where p.colaborador_id=c.id),
    'dias_laborables',c.dias_laborables,'hora_inicio',c.hora_inicio,
    'hora_fin',c.hora_fin,'horario_semanal',c.horario_semanal,
    'tipo_vinculo',c.tipo_vinculo,'contrato_inicio',c.contrato_inicio,
    'contrato_fin_referencia',c.contrato_fin_referencia,
    'contrato_horas',c.contrato_horas,
    'contrato_horas_voluntariado',c.contrato_horas_voluntariado,
    'horas_previas',c.horas_previas,'contrato_pendiente',c.contrato_pendiente,
    'contrato_nota',c.contrato_nota,
    'historial_cambios',(select count(*) from public.asis_historial_contrato h where h.colaborador_id=c.id),
    'resumen',public.dash_admin_resumen_contrato(c)
  ) order by a.orden,c.orden,c.nombre) into v_personas
  from public.asis_colaboradores c
  join public.asis_areas a on a.id=c.area_id
  where p_incluir_inactivos or c.activo;

  return jsonb_build_object(
    'ok',true,'rol',public.asis_rol(),'puede_editar',public.asis_puede_editar(),
    'areas',coalesce(v_areas,'[]'::jsonb),
    'personas',coalesce(v_personas,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.dash_admin_equipo(boolean) from public,anon;
grant execute on function public.dash_admin_equipo(boolean) to authenticated;


-- 4) HISTORIAL DE UN COLABORADOR ------------------------------------
create or replace function public.dash_admin_historial_colaborador(p_colab bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_historial jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if not exists(select 1 from public.asis_colaboradores where id=p_colab) then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id',h.id,'fecha',h.fecha,'tipo',h.tipo,'nota',h.nota,
    'horario_anterior',h.horario_anterior,'horario_nuevo',h.horario_nuevo,
    'horas_anterior',h.horas_anterior,'horas_nueva',h.horas_nueva,
    'created_at',h.created_at,'creado_por',p.nombre
  ) order by h.created_at desc) into v_historial
  from public.asis_historial_contrato h
  left join public.asis_perfiles p on p.id=h.creado_por
  where h.colaborador_id=p_colab;

  return jsonb_build_object('ok',true,'historial',coalesce(v_historial,'[]'::jsonb));
end;
$$;

revoke all on function public.dash_admin_historial_colaborador(bigint) from public,anon;
grant execute on function public.dash_admin_historial_colaborador(bigint) to authenticated;


-- 5) CREAR ÁREA ------------------------------------------------------
create or replace function public.dash_admin_crear_area(p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := trim(coalesce(p_nombre,''));
  v_area public.asis_areas;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if length(v_nombre)<2 or length(v_nombre)>60 then
    return jsonb_build_object('ok',false,'motivo','nombre');
  end if;
  if exists(select 1 from public.asis_areas where lower(nombre)=lower(v_nombre)) then
    return jsonb_build_object('ok',false,'motivo','duplicada');
  end if;

  insert into public.asis_areas(nombre,orden)
  values(v_nombre,coalesce((select max(orden)+1 from public.asis_areas),1))
  returning * into v_area;
  return jsonb_build_object('ok',true,'area',jsonb_build_object(
    'id',v_area.id,'nombre',v_area.nombre,'orden',v_area.orden,'activo',v_area.activo));
end;
$$;

revoke all on function public.dash_admin_crear_area(text) from public,anon;
grant execute on function public.dash_admin_crear_area(text) to authenticated;


-- 6) ALTA Y EDICIÓN ATÓMICA -----------------------------------------
create or replace function public.dash_admin_guardar_colaborador(
  p_datos jsonb,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_anterior public.asis_colaboradores;
  v_guardado public.asis_colaboradores;
  v_area bigint;
  v_nombre text := trim(coalesce(p_datos->>'nombre',''));
  v_dni text := nullif(regexp_replace(coalesce(p_datos->>'dni',''),'[^0-9]','','g'),'');
  v_vinculo text := coalesce(nullif(p_datos->>'tipo_vinculo',''),'practicas');
  v_hora_inicio time;
  v_hora_fin time;
  v_inicio date;
  v_fin_ref date;
  v_meta numeric;
  v_meta_vol int;
  v_previas numeric;
  v_pendiente boolean := false;
  v_nota text := nullif(trim(coalesce(p_datos->>'contrato_nota','')),'');
  v_activo boolean := true;
  v_horario jsonb := coalesce(p_datos->'horario_semanal','{}'::jsonb);
  v_horario_norm jsonb := '{}'::jsonb;
  v_dias int[] := array[]::int[];
  v_key text;
  v_dia jsonb;
  v_dia_norm jsonb;
  v_mod text;
  v_dia_vinc text;
  v_dia_ini time;
  v_dia_fin time;
  v_motivo text := nullif(left(trim(coalesce(p_motivo,'')),140),'');
  v_antes_horario jsonb;
  v_nuevo_horario jsonb;
  v_antes_fechas jsonb;
  v_nuevas_fechas jsonb;
  v_antes_identidad jsonb;
  v_nueva_identidad jsonb;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_datos is null or jsonb_typeof(p_datos)<>'object' then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;
  if length(v_nombre)<2 or length(v_nombre)>80 then
    return jsonb_build_object('ok',false,'motivo','nombre');
  end if;
  if v_dni is not null and v_dni !~ '^[0-9]{8}$' then
    return jsonb_build_object('ok',false,'motivo','dni');
  end if;
  if v_vinculo not in ('practicas','voluntariado','ambos') then
    return jsonb_build_object('ok',false,'motivo','vinculo');
  end if;
  if jsonb_typeof(v_horario)<>'object' then
    return jsonb_build_object('ok',false,'motivo','horario');
  end if;

  begin
    if nullif(p_datos->>'id','') is not null then v_id:=(p_datos->>'id')::bigint; end if;
    v_area:=(p_datos->>'area_id')::bigint;
    v_hora_inicio:=nullif(p_datos->>'hora_inicio','')::time;
    v_hora_fin:=nullif(p_datos->>'hora_fin','')::time;
    v_inicio:=nullif(p_datos->>'contrato_inicio','')::date;
    v_fin_ref:=nullif(p_datos->>'contrato_fin_referencia','')::date;
    v_meta:=nullif(p_datos->>'contrato_horas','')::numeric;
    v_meta_vol:=nullif(p_datos->>'contrato_horas_voluntariado','')::int;
    v_previas:=coalesce(nullif(p_datos->>'horas_previas','')::numeric,0);
    v_pendiente:=coalesce(nullif(p_datos->>'contrato_pendiente','')::boolean,false);
    v_activo:=coalesce(nullif(p_datos->>'activo','')::boolean,true);
  exception when others then
    return jsonb_build_object('ok',false,'motivo','datos');
  end;

  if not exists(select 1 from public.asis_areas where id=v_area and activo) then
    return jsonb_build_object('ok',false,'motivo','area');
  end if;
  if v_hora_inicio is not null and v_hora_fin is not null and v_hora_fin<=v_hora_inicio then
    return jsonb_build_object('ok',false,'motivo','horario_general');
  end if;
  if v_inicio is not null and v_fin_ref is not null and v_fin_ref<v_inicio then
    return jsonb_build_object('ok',false,'motivo','fechas');
  end if;
  if coalesce(v_meta,0)<0 or coalesce(v_meta_vol,0)<0 or v_previas<0 then
    return jsonb_build_object('ok',false,'motivo','horas');
  end if;
  if v_pendiente and length(coalesce(v_nota,''))>200 then
    return jsonb_build_object('ok',false,'motivo','nota');
  end if;
  if not v_pendiente then v_nota:=null; end if;
  if v_vinculo<>'ambos' then v_meta_vol:=null; end if;

  if v_dni is not null and exists(
    select 1 from public.asis_colaboradores c
    where regexp_replace(coalesce(c.dni,''),'[^0-9]','','g')=v_dni
      and (v_id is null or c.id<>v_id)
  ) then
    return jsonb_build_object('ok',false,'motivo','dni_duplicado');
  end if;

  for v_key,v_dia in select key,value from jsonb_each(v_horario) loop
    if v_key !~ '^[1-7]$' or jsonb_typeof(v_dia)<>'object' then
      return jsonb_build_object('ok',false,'motivo','horario');
    end if;
    v_mod:=coalesce(nullif(v_dia->>'mod',''),'no_gestiona');
    if v_mod not in ('no_gestiona','virtual','presencial','opcional') then
      return jsonb_build_object('ok',false,'motivo','modalidad','dia',v_key);
    end if;
    if v_mod='no_gestiona' then continue; end if;
    begin
      v_dia_ini:=coalesce(nullif(v_dia->>'ini','')::time,v_hora_inicio);
      v_dia_fin:=coalesce(nullif(v_dia->>'fin','')::time,v_hora_fin);
    exception when others then
      return jsonb_build_object('ok',false,'motivo','horario','dia',v_key);
    end;
    if v_dia_ini is null or v_dia_fin is null or v_dia_fin<=v_dia_ini then
      return jsonb_build_object('ok',false,'motivo','horario','dia',v_key);
    end if;
    v_dia_vinc:=coalesce(nullif(v_dia->>'vinc',''),'practicas');
    if v_dia_vinc not in ('practicas','voluntariado') then
      return jsonb_build_object('ok',false,'motivo','vinculo_dia','dia',v_key);
    end if;
    v_dia_norm:=jsonb_build_object(
      'mod',v_mod,'ini',to_char(v_dia_ini,'HH24:MI'),'fin',to_char(v_dia_fin,'HH24:MI'));
    if v_vinculo='ambos' then
      v_dia_norm:=v_dia_norm||jsonb_build_object('vinc',v_dia_vinc);
    end if;
    v_horario_norm:=v_horario_norm||jsonb_build_object(v_key,v_dia_norm);
    v_dias:=array_append(v_dias,v_key::int);
  end loop;
  select coalesce(array_agg(x order by x),array[]::int[]) into v_dias from unnest(v_dias) x;

  if v_id is null then
    insert into public.asis_colaboradores(
      area_id,nombre,dni,dias_laborables,hora_inicio,hora_fin,horario_semanal,
      contrato_horas,contrato_inicio,contrato_fin_referencia,horas_previas,
      tipo_vinculo,contrato_horas_voluntariado,contrato_pendiente,contrato_nota,
      activo,orden)
    values(
      v_area,v_nombre,v_dni,v_dias,v_hora_inicio,v_hora_fin,v_horario_norm,
      v_meta,v_inicio,v_fin_ref,v_previas,v_vinculo,v_meta_vol,v_pendiente,v_nota,
      v_activo,coalesce((select max(orden)+1 from public.asis_colaboradores),1))
    returning * into v_guardado;
  else
    select * into v_anterior from public.asis_colaboradores where id=v_id for update;
    if v_anterior is null then
      return jsonb_build_object('ok',false,'motivo','no_existe');
    end if;

    v_antes_horario:=jsonb_build_object(
      'hora_inicio',v_anterior.hora_inicio,'hora_fin',v_anterior.hora_fin,
      'dias',v_anterior.dias_laborables,'semana',v_anterior.horario_semanal,
      'vinculo',v_anterior.tipo_vinculo);
    v_nuevo_horario:=jsonb_build_object(
      'hora_inicio',v_hora_inicio,'hora_fin',v_hora_fin,
      'dias',v_dias,'semana',v_horario_norm,'vinculo',v_vinculo);
    v_antes_fechas:=jsonb_build_object(
      'inicio',v_anterior.contrato_inicio,'fin_referencia',v_anterior.contrato_fin_referencia,
      'horas_previas',v_anterior.horas_previas,'meta_voluntariado',v_anterior.contrato_horas_voluntariado,
      'pendiente',v_anterior.contrato_pendiente,'nota',v_anterior.contrato_nota);
    v_nuevas_fechas:=jsonb_build_object(
      'inicio',v_inicio,'fin_referencia',v_fin_ref,'horas_previas',v_previas,
      'meta_voluntariado',v_meta_vol,'pendiente',v_pendiente,'nota',v_nota);
    v_antes_identidad:=jsonb_build_object(
      'nombre',v_anterior.nombre,'dni',v_anterior.dni,'area_id',v_anterior.area_id,
      'activo',v_anterior.activo);
    v_nueva_identidad:=jsonb_build_object(
      'nombre',v_nombre,'dni',v_dni,'area_id',v_area,'activo',v_activo);

    update public.asis_colaboradores set
      area_id=v_area,nombre=v_nombre,dni=v_dni,dias_laborables=v_dias,
      hora_inicio=v_hora_inicio,hora_fin=v_hora_fin,horario_semanal=v_horario_norm,
      contrato_horas=v_meta,contrato_inicio=v_inicio,
      contrato_fin_referencia=v_fin_ref,horas_previas=v_previas,
      tipo_vinculo=v_vinculo,contrato_horas_voluntariado=v_meta_vol,
      contrato_pendiente=v_pendiente,contrato_nota=v_nota,activo=v_activo
    where id=v_id returning * into v_guardado;

    update public.asis_perfiles set nombre=v_nombre,activo=v_activo
    where colaborador_id=v_id and acceso_panel=false;
    if not v_activo and v_anterior.activo then
      update public.dash_sesiones set revocada_at=now()
      where perfil_id in (
        select id from public.asis_perfiles where colaborador_id=v_id and acceso_panel=false)
        and revocada_at is null;
    end if;

    if v_antes_horario is distinct from v_nuevo_horario then
      insert into public.asis_historial_contrato(
        colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
      values(v_id,'horario',v_antes_horario,v_nuevo_horario,v_motivo,auth.uid());
    end if;
    if v_anterior.contrato_horas is distinct from v_meta then
      insert into public.asis_historial_contrato(
        colaborador_id,tipo,horas_anterior,horas_nueva,nota,creado_por)
      values(v_id,'horas_contrato',v_anterior.contrato_horas,v_meta,v_motivo,auth.uid());
    end if;
    if v_antes_fechas is distinct from v_nuevas_fechas then
      insert into public.asis_historial_contrato(
        colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
      values(v_id,'fechas',v_antes_fechas,v_nuevas_fechas,v_motivo,auth.uid());
    end if;
    if v_antes_identidad is distinct from v_nueva_identidad then
      insert into public.asis_historial_contrato(
        colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
      values(v_id,'otro',v_antes_identidad,v_nueva_identidad,v_motivo,auth.uid());
    end if;
  end if;

  return jsonb_build_object('ok',true,'id',v_guardado.id,'nuevo',v_id is null);
exception
  when unique_violation then
    return jsonb_build_object('ok',false,'motivo','duplicado');
end;
$$;

revoke all on function public.dash_admin_guardar_colaborador(jsonb,text) from public,anon;
grant execute on function public.dash_admin_guardar_colaborador(jsonb,text) to authenticated;


-- 7) BAJA LÓGICA / REACTIVACIÓN -------------------------------------
create or replace function public.dash_admin_estado_colaborador(
  p_colab bigint,
  p_activo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior boolean;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  select activo into v_anterior from public.asis_colaboradores where id=p_colab for update;
  if v_anterior is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if v_anterior=p_activo then
    return jsonb_build_object('ok',true,'activo',p_activo,'sin_cambios',true);
  end if;
  update public.asis_colaboradores set activo=p_activo where id=p_colab;
  update public.asis_perfiles set activo=p_activo where colaborador_id=p_colab and acceso_panel=false;
  if not p_activo then
    update public.dash_sesiones set revocada_at=now()
      where perfil_id in (select id from public.asis_perfiles where colaborador_id=p_colab and acceso_panel=false)
        and revocada_at is null;
  end if;
  insert into public.asis_historial_contrato(
    colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
  values(p_colab,'otro',jsonb_build_object('activo',v_anterior),
         jsonb_build_object('activo',p_activo),
         case when p_activo then 'Reactivación de colaborador' else 'Baja lógica de colaborador' end,
         auth.uid());
  return jsonb_build_object('ok',true,'activo',p_activo);
end;
$$;

revoke all on function public.dash_admin_estado_colaborador(bigint,boolean) from public,anon;
grant execute on function public.dash_admin_estado_colaborador(bigint,boolean) to authenticated;

notify pgrst,'reload schema';

-- COMPROBACIÓN: las siete filas deben decir OK.
select case when count(*)=1 then 'OK' else 'REVISAR' end estado,p.proname pieza,
       count(*)::int encontrado,1 esperado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'dash_admin_horas_semana','dash_admin_resumen_contrato','dash_admin_equipo',
  'dash_admin_historial_colaborador','dash_admin_crear_area',
  'dash_admin_guardar_colaborador','dash_admin_estado_colaborador')
group by p.proname
order by p.proname;

commit;
