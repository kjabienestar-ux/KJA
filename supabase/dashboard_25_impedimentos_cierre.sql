-- DASHBOARD 25 — FASE 5 · COMUNICACIÓN DE IMPEDIMENTOS
-- Un aviso informa el problema, pero nunca completa el requisito ni desbloquea
-- la salida. Se resuelve automáticamente cuando la evidencia se entrega.

begin;

create table if not exists public.asis_cierre_impedimentos (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha date not null,
  requisito text not null check (requisito in ('comparticiones','rpe','asignado')),
  asignacion_id bigint references public.asis_asignaciones_diarias(id) on delete cascade,
  detalle text not null check (char_length(btrim(detalle)) between 10 and 700),
  estado text not null default 'abierto' check (estado in ('abierto','resuelto')),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  resuelto_at timestamptz,
  check ((requisito = 'asignado' and asignacion_id is not null) or (requisito <> 'asignado' and asignacion_id is null))
);

create unique index if not exists asis_cierre_impedimento_unico_idx
  on public.asis_cierre_impedimentos(colaborador_id, fecha, requisito, coalesce(asignacion_id, 0));
create index if not exists asis_cierre_impedimentos_fecha_idx
  on public.asis_cierre_impedimentos(fecha, estado, colaborador_id);

alter table public.asis_cierre_impedimentos enable row level security;
revoke all on public.asis_cierre_impedimentos from anon, authenticated;

create or replace function public.dash_reportar_impedimento(
  p_requisito text,
  p_asignacion bigint default null,
  p_detalle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_persona public.asis_colaboradores;
  v_id bigint;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  if p_requisito not in ('comparticiones','rpe','asignado')
     or char_length(btrim(coalesce(p_detalle, ''))) not between 10 and 700
     or (p_requisito = 'asignado') <> (p_asignacion is not null) then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  select * into v_persona from public.asis_colaboradores where id = v_colab and activo;
  if v_persona is null or not exists (
    select 1 from public.asis_registros r
     where r.colaborador_id = v_colab and r.fecha = v_hoy and r.salida_at is null
  ) then return jsonb_build_object('ok', false, 'motivo', 'jornada'); end if;
  if p_requisito = 'asignado' and not exists (
    select 1 from public.asis_asignaciones_diarias a
     where a.id = p_asignacion and a.fecha = v_hoy and a.activo and a.requerido
       and (a.colaborador_id = v_colab or a.area_id = v_persona.area_id)
  ) then return jsonb_build_object('ok', false, 'motivo', 'asignacion'); end if;
  if exists (
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id = v_colab and e.fecha = v_hoy and e.estado = 'completo'
       and e.requisito = p_requisito
       and coalesce(e.asignacion_id, 0) = coalesce(p_asignacion, 0)
  ) then return jsonb_build_object('ok', false, 'motivo', 'ya_completo'); end if;

  perform pg_advisory_xact_lock(v_colab);
  update public.asis_cierre_impedimentos
     set detalle = btrim(p_detalle), estado = 'abierto', actualizado_at = now(), resuelto_at = null
   where colaborador_id = v_colab and fecha = v_hoy and requisito = p_requisito
     and coalesce(asignacion_id, 0) = coalesce(p_asignacion, 0)
   returning id into v_id;
  if v_id is null then
    insert into public.asis_cierre_impedimentos(colaborador_id,fecha,requisito,asignacion_id,detalle)
    values(v_colab,v_hoy,p_requisito,p_asignacion,btrim(p_detalle)) returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'estado', 'abierto');
end;
$$;

create or replace function public.dash_mis_impedimentos_cierre()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_colab bigint := public.dash_colab(); v_hoy date := (now() at time zone 'America/Lima')::date; v_items jsonb;
begin
  if not public.dash_sesion_vigente() or v_colab is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'requisito',requisito,'asignacion_id',asignacion_id,'detalle',detalle,'estado',estado,'actualizado_at',actualizado_at) order by actualizado_at desc),'[]'::jsonb)
    into v_items from public.asis_cierre_impedimentos where colaborador_id=v_colab and fecha=v_hoy and estado='abierto';
  return jsonb_build_object('ok',true,'fecha',v_hoy,'impedimentos',v_items);
end; $$;

create or replace function public.dash_supervision_impedimentos(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'America/Lima')::date; v_dir boolean := coalesce(public.asis_rol()='direccion',false); v_lider boolean := coalesce(public.dash_sesion_vigente() and public.dash_nivel()='lider',false); v_items jsonb;
begin
  if not v_dir and not v_lider then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if p_fecha is null or p_fecha<date '2020-01-01' or p_fecha>v_hoy then return jsonb_build_object('ok',false,'motivo','fecha'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'colaborador_id',i.colaborador_id,'colaborador',c.nombre,'area_id',c.area_id,'area',a.nombre,'requisito',i.requisito,'asignacion_id',i.asignacion_id,'detalle',i.detalle,'estado',i.estado,'actualizado_at',i.actualizado_at) order by i.actualizado_at desc),'[]'::jsonb)
    into v_items from public.asis_cierre_impedimentos i join public.asis_colaboradores c on c.id=i.colaborador_id join public.asis_areas a on a.id=c.area_id
   where i.fecha=p_fecha and i.estado='abierto' and (v_dir or c.area_id=public.dash_area());
  return jsonb_build_object('ok',true,'fecha',p_fecha,'solo_lectura',v_lider,'impedimentos',v_items);
end; $$;

create or replace function public.asis_resolver_impedimento_entrega()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado='completo' then
    update public.asis_cierre_impedimentos set estado='resuelto',resuelto_at=now(),actualizado_at=now()
     where colaborador_id=new.colaborador_id and fecha=new.fecha and requisito=new.requisito and estado='abierto'
       and coalesce(asignacion_id,0)=coalesce(new.asignacion_id,0);
  end if;
  return new;
end; $$;
drop trigger if exists asis_resolver_impedimento_entrega_trg on public.asis_entregas_diarias;
create trigger asis_resolver_impedimento_entrega_trg after insert or update of estado on public.asis_entregas_diarias for each row execute function public.asis_resolver_impedimento_entrega();

revoke all on function public.asis_resolver_impedimento_entrega() from public, anon, authenticated;
revoke all on function public.dash_reportar_impedimento(text,bigint,text), public.dash_mis_impedimentos_cierre(), public.dash_supervision_impedimentos(date) from public, anon;
grant execute on function public.dash_reportar_impedimento(text,bigint,text), public.dash_mis_impedimentos_cierre(), public.dash_supervision_impedimentos(date) to authenticated;
notify pgrst, 'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,pieza,encontrado,esperado from (
 select 'tabla de impedimentos'::text pieza,count(*)::int encontrado,1 esperado from information_schema.tables where table_schema='public' and table_name='asis_cierre_impedimentos'
 union all select 'RPC de impedimentos',count(*)::int,3 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dash_reportar_impedimento','dash_mis_impedimentos_cierre','dash_supervision_impedimentos')
 union all select 'resolución automática',count(distinct trigger_name)::int,1 from information_schema.triggers where event_object_schema='public' and event_object_table='asis_entregas_diarias' and trigger_name='asis_resolver_impedimento_entrega_trg'
) q;
