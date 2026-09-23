-- DASHBOARD 74: entrada con evidencia registrada por Dirección.
-- Requiere 72 y 73, y desplegar la versión actualizada de dash-evidencia.
begin;

create table if not exists public.asis_entradas_direccion (
  id uuid primary key default gen_random_uuid(),
  colaborador_id bigint not null references public.asis_colaboradores(id),
  fecha date not null,
  hora time not null,
  modalidad text not null check(modalidad in ('virtual','presencial')),
  nota text not null,
  registrado_por uuid not null references public.asis_perfiles(id),
  ruta text not null unique,
  creado_at timestamptz not null default now(),
  vence_at timestamptz not null default now()+interval '15 minutes',
  confirmado_at timestamptz,
  registro_id bigint,
  resultado jsonb
);
alter table public.asis_entradas_direccion enable row level security;
revoke all on table public.asis_entradas_direccion from public,anon,authenticated;
create index if not exists asis_entradas_direccion_fecha_idx
  on public.asis_entradas_direccion(colaborador_id,fecha);

create or replace function public.dash_admin_entrada_permiso(
  p_colaborador bigint,p_fecha date,p_hora time,p_modalidad text,p_nota text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab public.asis_colaboradores;
  v_id uuid:=gen_random_uuid(); v_ruta text; v_entrada time; v_salida time;
begin
  if public.asis_rol() is distinct from 'direccion' or auth.uid() is null then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if not public.dash_sesion_vigente() then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  if p_fecha is null or p_fecha<date '2020-01-01' or p_fecha>(now() at time zone 'America/Lima')::date
     or p_hora is null or p_hora>=time '24:00'
     or (p_fecha+p_hora) at time zone 'America/Lima'>now() then
    return jsonb_build_object('ok',false,'motivo','fecha_hora');
  end if;
  if p_modalidad is null or p_modalidad not in ('virtual','presencial') then
    return jsonb_build_object('ok',false,'motivo','modalidad_invalida');
  end if;
  if length(btrim(coalesce(p_nota,'')))<5 or length(p_nota)>700 then
    return jsonb_build_object('ok',false,'motivo','nota_requerida');
  end if;
  select * into v_colab from public.asis_colaboradores where id=p_colaborador and activo;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if v_colab.contrato_inicio is not null and p_fecha<v_colab.contrato_inicio then
    return jsonb_build_object('ok',false,'motivo','antes_contrato');
  end if;
  if not public.asis_labora(v_colab,p_fecha) then return jsonb_build_object('ok',false,'motivo','no_labora'); end if;
  v_entrada:=public.asis_hora_entrada(v_colab,p_fecha);v_salida:=public.asis_hora_salida(v_colab,p_fecha);
  if v_entrada is null or v_salida is null or v_salida<=v_entrada then
    return jsonb_build_object('ok',false,'motivo','horario_incompleto');
  end if;
  perform pg_advisory_xact_lock(p_colaborador);
  if exists(select 1 from public.asis_registros where colaborador_id=p_colaborador and fecha=p_fecha) then
    return jsonb_build_object('ok',false,'motivo','ya_marcado');
  end if;
  v_ruta:=to_char(p_fecha,'YYYY/MM')||'/'||p_colaborador||'/'||to_char(p_fecha,'YYYY-MM-DD')||'.direccion.'||v_id||'.jpg';
  insert into public.asis_entradas_direccion(id,colaborador_id,fecha,hora,modalidad,nota,registrado_por,ruta)
    values(v_id,p_colaborador,p_fecha,p_hora,p_modalidad,btrim(p_nota),auth.uid(),v_ruta);
  return jsonb_build_object('ok',true,'permiso',v_id,'ruta',v_ruta,'nombre',v_colab.nombre,'servidor_at',now());
end $$;

create or replace function public.dash_admin_confirmar_entrada(p_permiso uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_permiso public.asis_entradas_direccion; v_colab public.asis_colaboradores;
  v_reg public.asis_registros; v_estado text; v_ini time; v_fin time; v_tol int; v_resultado jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' or auth.uid() is null then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if not public.dash_sesion_vigente() then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  select * into v_permiso from public.asis_entradas_direccion
    where id=p_permiso and registrado_por=auth.uid() for update;
  if v_permiso.id is null then return jsonb_build_object('ok',false,'motivo','permiso_invalido'); end if;
  perform pg_advisory_xact_lock(v_permiso.colaborador_id);
  select * into v_reg from public.asis_registros where colaborador_id=v_permiso.colaborador_id and fecha=v_permiso.fecha;
  if v_permiso.confirmado_at is not null then
    if v_reg.id=v_permiso.registro_id and v_reg.evidencia_path=v_permiso.ruta then return v_permiso.resultado; end if;
    return jsonb_build_object('ok',false,'motivo','registro_cambiado');
  end if;
  if v_reg.id is not null then return jsonb_build_object('ok',false,'motivo','ya_marcado'); end if;
  if v_permiso.vence_at<now() then return jsonb_build_object('ok',false,'motivo','permiso_vencido'); end if;
  select * into v_colab from public.asis_colaboradores where id=v_permiso.colaborador_id and activo;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if v_colab.contrato_inicio is not null and v_permiso.fecha<v_colab.contrato_inicio then
    return jsonb_build_object('ok',false,'motivo','antes_contrato');
  end if;
  if not public.asis_labora(v_colab,v_permiso.fecha) then return jsonb_build_object('ok',false,'motivo','no_labora'); end if;
  v_ini:=public.asis_hora_entrada(v_colab,v_permiso.fecha);v_fin:=public.asis_hora_salida(v_colab,v_permiso.fecha);
  if v_ini is null or v_fin is null or v_fin<=v_ini then return jsonb_build_object('ok',false,'motivo','horario_incompleto'); end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='asis-evidencias' and o.name=v_permiso.ruta
    and o.created_at>=v_permiso.creado_at
    and o.metadata->>'mimetype'='image/jpeg'
    and (o.metadata->>'size')::numeric between 1 and 2097152) then
    return jsonb_build_object('ok',false,'motivo','evidencia_no_verificada');
  end if;
  select coalesce(tolerancia_min,15) into v_tol from public.asis_portal_config where id=1;
  v_estado:=case when v_permiso.hora<=v_ini+make_interval(mins=>coalesce(v_tol,15)) then 'P' else 'T' end;
  insert into public.asis_registros(colaborador_id,fecha,estado,nota,marcado_por,marcado_at,origen,
    horas,vinculo,evidencia_path,evidencia_origen,evidencia_at,modalidad_marcada)
  values(v_colab.id,v_permiso.fecha,v_estado,v_permiso.nota,auth.uid(),
    (v_permiso.fecha+v_permiso.hora) at time zone 'America/Lima','panel',
    public.asis_horas_dia(v_colab,v_permiso.fecha),public.asis_vinc_dia(v_colab,v_permiso.fecha),
    v_permiso.ruta,'archivo',now(),v_permiso.modalidad)
  returning * into v_reg;
  v_resultado:=jsonb_build_object('ok',true,'registro_id',v_reg.id,'estado',v_estado,
    'modalidad',v_permiso.modalidad,'marcado_at',v_reg.marcado_at,'fecha',v_permiso.fecha,'origen','panel');
  update public.asis_entradas_direccion set confirmado_at=now(),registro_id=v_reg.id,resultado=v_resultado where id=v_permiso.id;
  return v_resultado;
exception when unique_violation then return jsonb_build_object('ok',false,'motivo','ya_marcado');
end $$;

revoke all on function public.dash_admin_entrada_permiso(bigint,date,time,text,text),
  public.dash_admin_confirmar_entrada(uuid) from public,anon;
grant execute on function public.dash_admin_entrada_permiso(bigint,date,time,text,text),
  public.dash_admin_confirmar_entrada(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
