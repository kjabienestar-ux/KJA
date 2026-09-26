-- Aplicar despues de dashboard_75_pausas_activas.sql y antes del nuevo frontend.
-- Conserva consumos existentes. Cada pausa nueva tiene un plazo unico del servidor.
begin;

create table if not exists public.asis_pausa_sesiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.asis_pausas_activas(id) on delete cascade,
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha date not null,
  pausa text not null check (pausa in ('movilidad','visual')),
  estado text not null default 'en_curso' check (estado in ('en_curso','completada','abandonada')),
  inicio_at timestamptz not null,
  fin_at timestamptz not null,
  cerrado_at timestamptz,
  check (fin_at > inicio_at),
  unique(registro_id,pausa)
);
create unique index if not exists asis_pausa_unica_en_curso
  on public.asis_pausa_sesiones(colaborador_id) where estado='en_curso';
alter table public.asis_pausa_sesiones enable row level security;
revoke all on public.asis_pausa_sesiones from public,anon,authenticated;

-- Solo las RPC autorizadas pueden llamar a este helper. Su llamador mantiene
-- el mismo bloqueo que los reseteos de dashboard_75.
create or replace function public.dash_pausas_estado(p_colab bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_fecha date:=(v_now at time zone 'America/Lima')::date;
  v_pausas jsonb;
  v_sesion jsonb;
begin
  update public.asis_pausa_sesiones set estado='completada',cerrado_at=fin_at
    where colaborador_id=p_colab and estado='en_curso' and fin_at<=v_now;
  select pausas into v_pausas from public.asis_pausas_activas
    where colaborador_id=p_colab and fecha=v_fecha;
  select jsonb_build_object('id',s.id,'pausa',s.pausa,'estado',s.estado,
    'inicio_at',s.inicio_at,'fin_at',s.fin_at,'cerrado_at',s.cerrado_at)
    into v_sesion from public.asis_pausa_sesiones s
    where s.colaborador_id=p_colab and s.fecha=v_fecha
    order by s.inicio_at desc,s.id desc limit 1;
  return jsonb_build_object('ok',true,'version',2,'colaborador_id',p_colab,
    'fecha',v_fecha,'ahora',v_now,'pausas',coalesce(v_pausas,'[]'::jsonb),'sesion',v_sesion);
end $$;

create or replace function public.dash_mis_pausas()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  select id into v_id from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  perform pg_advisory_xact_lock(750075);
  return public.dash_pausas_estado(v_id);
end $$;

create or replace function public.dash_iniciar_pausa(p_break_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_colab public.asis_colaboradores;
  v_now timestamptz; v_fecha date; v_duracion interval; v_limite timestamptz;
  v_estado jsonb; v_pausas jsonb; v_reg uuid;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  if p_break_id is null or p_break_id not in ('movilidad','visual') then
    return jsonb_build_object('ok',false,'motivo','pausa_invalida');
  end if;
  select * into v_colab from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  perform pg_advisory_xact_lock(750075);
  v_now:=clock_timestamp(); v_fecha:=(v_now at time zone 'America/Lima')::date;
  v_estado:=public.dash_pausas_estado(v_colab.id);
  -- Reintentos, recargas y otras pestanas recuperan la misma sesion.
  if v_estado->'sesion'->>'estado'='en_curso' then return v_estado; end if;
  if not coalesce(public.asis_labora(v_colab,v_fecha),false)
    or not coalesce((v_now at time zone 'America/Lima')::time >= public.asis_hora_entrada(v_colab,v_fecha)
      and (v_now at time zone 'America/Lima')::time < public.asis_hora_salida(v_colab,v_fecha),false)
    or not exists(select 1 from public.asis_registros where colaborador_id=v_colab.id
      and fecha=v_fecha and estado in ('P','T') and marcado_at<=v_now and salida_at is null) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario');
  end if;
  v_duracion:=case when p_break_id='movilidad' then interval '20 minutes' else interval '10 minutes' end;
  v_limite:=(v_fecha+public.asis_hora_salida(v_colab,v_fecha)) at time zone 'America/Lima';
  if v_limite is null or v_now+v_duracion>v_limite then
    return jsonb_build_object('ok',false,'motivo','tiempo_insuficiente');
  end if;
  v_pausas:=v_estado->'pausas';
  if v_pausas ? p_break_id then return jsonb_build_object('ok',false,'motivo','consumida'); end if;
  if jsonb_array_length(v_pausas)>=2 then return jsonb_build_object('ok',false,'motivo','limite'); end if;
  v_pausas:=v_pausas||jsonb_build_array(p_break_id);
  insert into public.asis_pausas_activas(colaborador_id,fecha,pausas,completadas_count)
    values(v_colab.id,v_fecha,v_pausas,jsonb_array_length(v_pausas))
    on conflict(colaborador_id,fecha) do update set pausas=excluded.pausas,
      completadas_count=excluded.completadas_count,actualizado_at=v_now
    returning id into v_reg;
  insert into public.asis_pausa_sesiones(registro_id,colaborador_id,fecha,pausa,inicio_at,fin_at)
    values(v_reg,v_colab.id,v_fecha,p_break_id,v_now,v_now+v_duracion);
  return public.dash_pausas_estado(v_colab.id);
end $$;

create or replace function public.dash_cerrar_pausa(p_sesion uuid,p_abandonar boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint; v_sesion public.asis_pausa_sesiones; v_now timestamptz;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  select id into v_id from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  perform pg_advisory_xact_lock(750075);
  select * into v_sesion from public.asis_pausa_sesiones where id=p_sesion and colaborador_id=v_id;
  if v_sesion.id is null then return jsonb_build_object('ok',false,'motivo','sesion_no_disponible'); end if;
  v_now:=clock_timestamp();
  if v_sesion.estado='en_curso' then
    if v_now<v_sesion.fin_at and not coalesce(p_abandonar,false) then
      return jsonb_build_object('ok',false,'motivo','tiempo_pendiente');
    end if;
    update public.asis_pausa_sesiones set
      estado=case when v_now>=fin_at then 'completada' else 'abandonada' end,
      cerrado_at=case when v_now>=fin_at then fin_at else v_now end
      where id=v_sesion.id;
  end if;
  return public.dash_pausas_estado(v_id);
end $$;

create or replace function public.dash_admin_pausas_diarias(p_fecha date default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_fecha date:=coalesce(p_fecha,(now() at time zone 'America/Lima')::date); v_filas jsonb;
begin
  if auth.uid() is null or public.asis_rol() is distinct from 'direccion' or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'colaborador_id',c.id,'colaborador',c.nombre,'area_id',c.area_id,'area',coalesce(a.nombre,'Sin área'),
    'activo',c.activo,'pausas',coalesce(p.pausas,'[]'::jsonb),'completadas_count',coalesce(p.completadas_count,0),
    'actualizado_at',p.actualizado_at,'sesiones',(select coalesce(jsonb_agg(jsonb_build_object(
      'pausa',s.pausa,'estado',case when s.estado='en_curso' and s.fin_at<=clock_timestamp() then 'completada' else s.estado end,
      'inicio_at',s.inicio_at,'fin_at',s.fin_at) order by s.inicio_at),'[]'::jsonb)
      from public.asis_pausa_sesiones s where s.registro_id=p.id)
  ) order by c.nombre),'[]'::jsonb) into v_filas
  from public.asis_colaboradores c left join public.asis_areas a on a.id=c.area_id
    left join public.asis_pausas_activas p on p.colaborador_id=c.id and p.fecha=v_fecha where c.activo;
  return jsonb_build_object('ok',true,'fecha',v_fecha,'filas',v_filas);
end $$;

-- El portal anterior no puede consumir una pausa sin recuperar la sesion.
create or replace function public.dash_registrar_pausa(p_break_id text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('ok',false,'motivo','actualizar_portal')
$$;
revoke all on function public.dash_pausas_estado(bigint) from public,anon,authenticated;
revoke all on function public.dash_mis_pausas(),public.dash_iniciar_pausa(text),
  public.dash_cerrar_pausa(uuid,boolean),public.dash_registrar_pausa(text) from public,anon,authenticated;
revoke all on function public.dash_admin_pausas_diarias(date) from public,anon,authenticated;
grant execute on function public.dash_mis_pausas(),public.dash_iniciar_pausa(text),
  public.dash_cerrar_pausa(uuid,boolean),public.dash_registrar_pausa(text) to authenticated;
grant execute on function public.dash_admin_pausas_diarias(date) to authenticated;
notify pgrst,'reload schema';
commit;
