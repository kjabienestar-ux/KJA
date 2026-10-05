-- Ejecutar después de dashboard_88.
-- Incorpora las asistencias del 02/10 corregidas después de asignar el beneficio.
-- No borra descansos ya concedidos ni modifica marcas o evidencias.
begin;

create or replace function public.asis_otorgar_descanso_al_corregir()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.fecha=date '2026-10-02'
    and new.estado in ('P','T') and new.marcado_at is not null
    and new.modalidad_marcada='presencial'
    and exists(select 1 from public.asis_colaboradores where id=new.colaborador_id and activo) then
    insert into public.asis_descansos_presenciales(colaborador_id,fecha,fecha_presencial)
      values(new.colaborador_id,date '2026-10-05',date '2026-10-02')
      on conflict(colaborador_id,fecha) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.asis_otorgar_descanso_al_corregir() from public,anon,authenticated;

drop trigger if exists asis_registro_otorga_descanso on public.asis_registros;
create trigger asis_registro_otorga_descanso
after insert or update of modalidad_marcada,estado,marcado_at,fecha,colaborador_id
on public.asis_registros for each row execute function public.asis_otorgar_descanso_al_corregir();

-- Repara también los casos ya corregidos, sin depender del nombre de la persona.
select public.asis_otorgar_descanso_presencial(date '2026-10-02',date '2026-10-05') as nuevos_beneficiarios;
notify pgrst,'reload schema';
commit;
