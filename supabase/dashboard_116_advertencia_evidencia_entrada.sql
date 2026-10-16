-- Retirar una evidencia de entrada y enviar una advertencia por decisión de Dirección.
-- Requiere dashboard_115 y el centro de notificaciones (41/50).
begin;
create table if not exists public.asis_entrada_advertencias (
  id bigint generated always as identity primary key,
  registro_id bigint not null,
  colaborador_id bigint not null,
  fecha date not null,
  path text not null,
  motivo text not null check (char_length(btrim(motivo)) between 5 and 400),
  mensaje text not null,
  actor_id uuid not null,
  creado_at timestamptz not null default now(),
  unique(registro_id,path)
);
alter table public.asis_entrada_advertencias enable row level security;
revoke all on public.asis_entrada_advertencias from public,anon,authenticated;
grant all on public.asis_entrada_advertencias to service_role;

create or replace function public.dash_admin_advertir_entrada(
  p_colaborador bigint,p_fecha date,p_path text,p_motivo text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_reg public.asis_registros;
  v_id bigint;
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_mensaje text;
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false)
    or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_colaborador is null or p_fecha is null or p_fecha>(now() at time zone 'America/Lima')::date
    or nullif(btrim(p_path),'') is null or char_length(v_motivo) not between 5 and 400 then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;
  perform pg_advisory_xact_lock(p_colaborador);
  select * into v_reg from public.asis_registros
    where colaborador_id=p_colaborador and fecha=p_fecha for update;
  if not found then return jsonb_build_object('ok',false,'motivo','sin_registro'); end if;
  -- Una respuesta perdida puede reintentarse sin duplicar la advertencia.
  select id into v_id from public.asis_entrada_advertencias
    where registro_id=v_reg.id and path=p_path;
  if found then return jsonb_build_object('ok',true,'advertencia',v_id,'ya_notificada',true); end if;
  if v_reg.evidencia_path is distinct from p_path then
    return jsonb_build_object('ok',false,'motivo','archivo_ajeno');
  end if;
  v_mensaje:='Dirección retiró tu evidencia de entrada del '||to_char(p_fecha,'DD/MM/YYYY')||
    ' por considerarla falsa. Motivo: '||v_motivo||
    '. Si vuelves a presentar evidencia falsa, se te notificará mediante una carta de advertencia.';
  insert into public.asis_entrada_advertencias(registro_id,colaborador_id,fecha,path,motivo,mensaje,actor_id)
    values(v_reg.id,p_colaborador,p_fecha,p_path,v_motivo,v_mensaje,auth.uid()) returning id into v_id;
  -- Se conserva el archivo privado como respaldo de la decisión, sin borrarlo de Storage.
  -- No cambia la marca, salida, horas, estado de asistencia ni metas contractuales.
  update public.asis_registros set evidencia_path=null where id=v_reg.id;
  insert into public.asis_notificaciones(colaborador_id,tipo,titulo,mensaje,fecha,actor_id,datos,dedupe_key)
    values(p_colaborador,'mensaje_direccion','Advertencia por evidencia de entrada',v_mensaje,p_fecha,auth.uid(),
      jsonb_build_object('advertencia_entrada_id',v_id),'entrada-advertencia:'||v_id);
  return jsonb_build_object('ok',true,'advertencia',v_id);
end $$;
revoke all on function public.dash_admin_advertir_entrada(bigint,date,text,text) from public,anon;
grant execute on function public.dash_admin_advertir_entrada(bigint,date,text,text) to authenticated;

-- Conserva las comprobaciones de acceso de la consulta original.
do $$ begin
  if to_regprocedure('public.dash_equipo_dia_detalle_base_116(bigint,date)') is null then
    alter function public.dash_equipo_dia_detalle(bigint,date) rename to dash_equipo_dia_detalle_base_116;
  end if;
end $$;
revoke all on function public.dash_equipo_dia_detalle_base_116(bigint,date) from public,anon,authenticated;
create or replace function public.dash_equipo_dia_detalle(p_colaborador bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_data jsonb; v_aviso jsonb;
begin
  v_data:=public.dash_equipo_dia_detalle_base_116(p_colaborador,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select jsonb_build_object('motivo',a.motivo,'mensaje',a.mensaje,'creado_at',a.creado_at)
    into v_aviso from public.asis_entrada_advertencias a
    join public.asis_registros r on r.id=a.registro_id and r.evidencia_path is null
    where a.colaborador_id=p_colaborador and a.fecha=p_fecha order by a.id desc limit 1;
  return v_data||jsonb_build_object('entrada_advertencia',v_aviso);
end $$;
revoke all on function public.dash_equipo_dia_detalle(bigint,date) from public,anon;
grant execute on function public.dash_equipo_dia_detalle(bigint,date) to authenticated;
notify pgrst,'reload schema';
commit;
