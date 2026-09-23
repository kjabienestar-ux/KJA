-- DASHBOARD 75: Monitoreo, registro y reseteo administrativo de pausas activas.
begin;

create table if not exists public.asis_pausas_activas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha date not null,
  pausas jsonb not null default '[]'::jsonb,
  completadas_count int not null default 0,
  actualizado_at timestamptz not null default now(),
  unique(colaborador_id, fecha)
);

alter table public.asis_pausas_activas enable row level security;

-- Política de lectura para colaboradores autenticados (sus propias pausas) y Dirección (todas)
drop policy if exists asis_pausas_activas_select on public.asis_pausas_activas;
create policy asis_pausas_activas_select on public.asis_pausas_activas
  for select to authenticated
  using (
    public.asis_rol() = 'direccion'
    or colaborador_id = public.dash_colab()
  );

-- Política de inserción/actualización
-- Solo las RPC pueden consumir o restablecer el saldo.
drop policy if exists asis_pausas_activas_all on public.asis_pausas_activas;
revoke all on public.asis_pausas_activas from public, anon, authenticated;
grant select on public.asis_pausas_activas to authenticated;

create or replace function public.dash_mis_pausas()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_id bigint;
  v_fecha date := (now() at time zone 'America/Lima')::date;
  v_pausas jsonb;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  select id into v_id from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  select pausas into v_pausas from public.asis_pausas_activas where colaborador_id=v_id and fecha=v_fecha;
  return jsonb_build_object('ok',true,'fecha',v_fecha,'pausas',coalesce(v_pausas,'[]'::jsonb));
end $$;

create or replace function public.dash_registrar_pausa(p_break_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab public.asis_colaboradores;
  v_fecha date := (now() at time zone 'America/Lima')::date;
  v_hora time := (now() at time zone 'America/Lima')::time;
  v_pausas jsonb;
begin
  if auth.uid() is null or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok',false,'motivo','sin_sesion');
  end if;
  if p_break_id is null or p_break_id not in ('movilidad','visual') then
    return jsonb_build_object('ok',false,'motivo','pausa_invalida');
  end if;
  select * into v_colab from public.asis_colaboradores where id=public.dash_colab() and activo;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','sin_colaborador'); end if;
  -- Bloqueo compartido por consumo y reseteos, incluso sin fila previa.
  perform pg_advisory_xact_lock(750075);
  if not coalesce(public.asis_labora(v_colab,v_fecha),false)
    or not coalesce(v_hora >= public.asis_hora_entrada(v_colab,v_fecha)
      and v_hora < public.asis_hora_salida(v_colab,v_fecha),false)
    or not exists(select 1 from public.asis_registros where colaborador_id=v_colab.id
      and fecha=v_fecha and estado in ('P','T') and marcado_at<=now() and salida_at is null) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario');
  end if;
  select pausas into v_pausas from public.asis_pausas_activas where colaborador_id=v_colab.id and fecha=v_fecha;
  v_pausas:=coalesce(v_pausas,'[]'::jsonb);
  if jsonb_array_length(v_pausas)>=2 then return jsonb_build_object('ok',false,'motivo','limite'); end if;
  if v_pausas ? p_break_id then return jsonb_build_object('ok',false,'motivo','consumida'); end if;
  v_pausas:=v_pausas || jsonb_build_array(p_break_id);
  insert into public.asis_pausas_activas(colaborador_id,fecha,pausas,completadas_count)
    values(v_colab.id,v_fecha,v_pausas,jsonb_array_length(v_pausas))
  on conflict(colaborador_id,fecha) do update set pausas=excluded.pausas,
    completadas_count=excluded.completadas_count,actualizado_at=now();
  return jsonb_build_object('ok',true,'fecha',v_fecha,'pausas',v_pausas);
end $$;



create or replace function public.dash_admin_pausas_diarias(p_fecha date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Lima')::date);
  v_filas jsonb;
begin
  if auth.uid() is null or public.asis_rol() is distinct from 'direccion' or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'colaborador_id', c.id,
      'colaborador', c.nombre,
      'area_id', c.area_id,
      'area', coalesce(a.nombre, 'Sin área'),
      'activo', c.activo,
      'pausas', coalesce(p.pausas, '[]'::jsonb),
      'completadas_count', coalesce(p.completadas_count, 0),
      'actualizado_at', p.actualizado_at
    ) order by c.nombre
  ), '[]'::jsonb)
  into v_filas
  from public.asis_colaboradores c
  left join public.asis_areas a on a.id = c.area_id
  left join public.asis_pausas_activas p on p.colaborador_id = c.id and p.fecha = v_fecha
  where c.activo;

  return jsonb_build_object('ok', true, 'fecha', v_fecha, 'filas', v_filas);
end;
$$;

-- Función para resetear las pausas de un colaborador específico (Dirección)
create or replace function public.dash_admin_reset_pausas(p_colaborador_id bigint, p_fecha date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Lima')::date);
begin
  if auth.uid() is null or public.asis_rol() is distinct from 'direccion' or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  if v_fecha <> (now() at time zone 'America/Lima')::date then
    return jsonb_build_object('ok',false,'motivo','solo_hoy');
  end if;
  perform pg_advisory_xact_lock(750075);
  delete from public.asis_pausas_activas
  where colaborador_id = p_colaborador_id and fecha = v_fecha;

  return jsonb_build_object('ok', true, 'colaborador_id', p_colaborador_id, 'fecha', v_fecha);
end;
$$;

-- Función para resetear todas las pausas activas del día (Dirección)
create or replace function public.dash_admin_reset_todas_pausas(p_fecha date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Lima')::date);
begin
  if auth.uid() is null or public.asis_rol() is distinct from 'direccion' or not public.dash_sesion_vigente() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  if v_fecha <> (now() at time zone 'America/Lima')::date then
    return jsonb_build_object('ok',false,'motivo','solo_hoy');
  end if;
  perform pg_advisory_xact_lock(750075);
  delete from public.asis_pausas_activas
  where fecha = v_fecha;

  return jsonb_build_object('ok', true, 'fecha', v_fecha);
end;
$$;


revoke all on function public.dash_mis_pausas(), public.dash_registrar_pausa(text), public.dash_admin_pausas_diarias(date), public.dash_admin_reset_pausas(bigint,date), public.dash_admin_reset_todas_pausas(date) from public,anon;
grant execute on function public.dash_mis_pausas(), public.dash_registrar_pausa(text), public.dash_admin_pausas_diarias(date), public.dash_admin_reset_pausas(bigint,date), public.dash_admin_reset_todas_pausas(date) to authenticated;
commit;
