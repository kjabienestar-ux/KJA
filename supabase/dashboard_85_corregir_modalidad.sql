-- DASHBOARD 85: corrección administrativa de modalidad para una fecha registrada.
-- Aplicar después de las migraciones 73 y 84.
begin;
create table if not exists public.asis_correcciones_modalidad (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references public.asis_colaboradores(id),
  fecha date not null,
  modalidad_anterior text,
  modalidad_nueva text not null check (modalidad_nueva in ('virtual','presencial')),
  cambiado_por uuid not null references public.asis_perfiles(id),
  creado_at timestamptz not null default now()
);
alter table public.asis_correcciones_modalidad enable row level security;
revoke all on table public.asis_correcciones_modalidad from public,anon,authenticated;

create or replace function public.dash_admin_cambiar_modalidad(
  p_colaborador bigint,p_fecha date,p_modalidad text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab public.asis_colaboradores;
  v_reg public.asis_registros;
  v_anterior text;
  v_base text;
begin
  if auth.uid() is null or not coalesce(public.asis_puede_editar(),false) then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if not coalesce(public.dash_sesion_vigente(),false) then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if p_fecha is null or p_fecha>(now() at time zone 'America/Lima')::date then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  if p_modalidad is null or p_modalidad not in ('virtual','presencial') then
    return jsonb_build_object('ok',false,'motivo','modalidad_invalida');
  end if;
  select * into v_colab from public.asis_colaboradores where id=p_colaborador;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  perform pg_advisory_xact_lock(p_colaborador);
  select * into v_reg from public.asis_registros
    where colaborador_id=p_colaborador and fecha=p_fecha for update;
  if not found then return jsonb_build_object('ok',false,'motivo','sin_registro'); end if;
  v_anterior:=public.asis_modalidad_efectiva(p_colaborador,p_fecha);
  if v_anterior=p_modalidad then return jsonb_build_object('ok',true,'modalidad',p_modalidad); end if;
  v_base:=public.asis_modalidad_base(v_colab,p_fecha);
  if v_base is null or v_base not in ('virtual','presencial','opcional') then v_base:=p_modalidad; end if;
  -- Conserva autor, horas, estado, origen y evidencias de la marca original.
  update public.asis_registros set modalidad_marcada=p_modalidad
    where colaborador_id=p_colaborador and fecha=p_fecha;
  -- El trigger 73 sincroniza el día; aquí se atribuye la corrección al editor actual.
  insert into public.asis_modalidades_diarias(colaborador_id,fecha,modalidad,modalidad_base,cambiado_por)
    values(p_colaborador,p_fecha,p_modalidad,v_base,auth.uid())
    on conflict(colaborador_id,fecha) do update set modalidad=excluded.modalidad,
      cambiado_por=excluded.cambiado_por,actualizado_at=now();
  insert into public.asis_correcciones_modalidad(colaborador_id,fecha,modalidad_anterior,modalidad_nueva,cambiado_por)
    values(p_colaborador,p_fecha,v_anterior,p_modalidad,auth.uid());
  return jsonb_build_object('ok',true,'modalidad',p_modalidad);
end $$;
revoke all on function public.dash_admin_cambiar_modalidad(bigint,date,text) from public,anon;
grant execute on function public.dash_admin_cambiar_modalidad(bigint,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
