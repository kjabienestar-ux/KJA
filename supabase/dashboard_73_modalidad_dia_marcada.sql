-- DASHBOARD 73: la modalidad confirmada actualiza únicamente su fecha.
-- Aplicar después de dashboard_72_modalidad_reportes.sql.
-- No cambia el horario semanal ni las horas de entrada/salida.
begin;

create or replace function public.asis_sincronizar_modalidad_marcada()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_colab public.asis_colaboradores; v_base text;
begin
  if new.modalidad_marcada is null or new.modalidad_marcada not in ('virtual','presencial') then
    return new;
  end if;
  select * into v_colab from public.asis_colaboradores where id=new.colaborador_id;
  v_base:=public.asis_modalidad_base(v_colab,new.fecha);
  -- Una regularización puede corresponder a un día sin horario base laborable.
  if v_base is null or v_base not in ('virtual','presencial','opcional') then
    v_base:=new.modalidad_marcada;
  end if;
  insert into public.asis_modalidades_diarias
    (colaborador_id,fecha,modalidad,modalidad_base,cambiado_por)
  values(new.colaborador_id,new.fecha,new.modalidad_marcada,v_base,new.marcado_por)
  on conflict(colaborador_id,fecha) do update set
    modalidad=excluded.modalidad,
    cambiado_por=coalesce(excluded.cambiado_por,asis_modalidades_diarias.cambiado_por),
    actualizado_at=now()
  where asis_modalidades_diarias.modalidad is distinct from excluded.modalidad;
  return new;
end $$;

revoke all on function public.asis_sincronizar_modalidad_marcada() from public,anon,authenticated;

drop trigger if exists asis_registro_sincroniza_modalidad on public.asis_registros;
create trigger asis_registro_sincroniza_modalidad
after insert or update of modalidad_marcada on public.asis_registros
for each row execute function public.asis_sincronizar_modalidad_marcada();

notify pgrst,'reload schema';
commit;
