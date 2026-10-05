-- Ejecutar después de dashboard_89.
-- Usa la misma modalidad que muestra el calendario. Exige una entrada real.
begin;
create or replace function public.asis_otorgar_descanso_presencial(p_presencial date,p_descanso date)
returns integer language plpgsql security definer set search_path=public as $$
declare v_total integer;
begin
  if p_presencial is null or p_descanso is null or p_descanso<=p_presencial then
    raise exception 'Fechas de descanso inválidas';
  end if;
  insert into public.asis_descansos_presenciales(colaborador_id,fecha,fecha_presencial)
  select r.colaborador_id,p_descanso,p_presencial
  from public.asis_registros r join public.asis_colaboradores c on c.id=r.colaborador_id
  where c.activo and r.fecha=p_presencial and r.estado in ('P','T')
    and r.marcado_at is not null
    and public.asis_modalidad_efectiva(r.colaborador_id,r.fecha)='presencial'
  on conflict(colaborador_id,fecha) do nothing;
  get diagnostics v_total=row_count;
  return v_total;
end $$;
revoke all on function public.asis_otorgar_descanso_presencial(date,date) from public,anon,authenticated;

create or replace function public.asis_otorgar_descanso_al_corregir()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.fecha=date '2026-10-02'
    and new.estado in ('P','T') and new.marcado_at is not null
    and public.asis_modalidad_efectiva(new.colaborador_id,new.fecha)='presencial'
    and exists(select 1 from public.asis_colaboradores where id=new.colaborador_id and activo) then
    insert into public.asis_descansos_presenciales(colaborador_id,fecha,fecha_presencial)
      values(new.colaborador_id,date '2026-10-05',date '2026-10-02')
      on conflict(colaborador_id,fecha) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.asis_otorgar_descanso_al_corregir() from public,anon,authenticated;

select public.asis_otorgar_descanso_presencial(date '2026-10-02',date '2026-10-05') as nuevos_beneficiarios;
notify pgrst,'reload schema';
commit;

-- Diagnóstico de Laura: la P del libro significa Presente, no Presencial.
select c.id,c.nombre,c.activo,r.estado,r.marcado_at,r.modalidad_marcada,
  public.asis_modalidad_efectiva(c.id,date '2026-10-02') as modalidad_calendario,
  d.fecha as dia_libre,
  case when d.fecha is not null then 'Día libre asignado'
    when not c.activo then 'Colaboradora inactiva'
    when r.colaborador_id is null then 'Sin registro del 2 de octubre'
    when r.estado is null or r.estado not in ('P','T') then 'La entrada no tiene estado P o T'
    when r.marcado_at is null then 'Falta la hora de entrada'
    when public.asis_modalidad_efectiva(c.id,date '2026-10-02') is distinct from 'presencial' then 'La modalidad registrada no es presencial'
    else 'Revisar asignación' end as resultado
from public.asis_colaboradores c
left join public.asis_registros r on r.colaborador_id=c.id and r.fecha=date '2026-10-02'
left join public.asis_descansos_presenciales d on d.colaborador_id=c.id and d.fecha=date '2026-10-05'
where c.nombre ilike '%Laura%';
