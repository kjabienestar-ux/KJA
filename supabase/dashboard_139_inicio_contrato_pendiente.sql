-- Completar o corregir el inicio pendiente sin afectar registros ni jornadas existentes. Requiere dashboard_132.
begin;
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.asis_colaboradores'::regclass
      and tgname='asis_proteger_jornada' and tgenabled in ('O','A')
  ) then
    raise exception 'Aplica dashboard_132 antes de habilitar el inicio pendiente';
  end if;
end $$;

create or replace function public.asis_proteger_jornada()
returns trigger language plpgsql security definer set search_path=public as $$
declare d integer; a jsonb; b jsonb; ma text; mb text;
begin
  if (new.horario_semanal,new.dias_laborables,new.hora_inicio,new.hora_fin,new.tipo_vinculo,new.contrato_inicio)
    is distinct from (old.horario_semanal,old.dias_laborables,old.hora_inicio,old.hora_fin,old.tipo_vinculo,old.contrato_inicio) then
    if new.tipo_vinculo is distinct from old.tipo_vinculo then
      raise exception using errcode='P0001',message='jornada_requiere_vigencia';
    end if;
    if new.contrato_inicio is distinct from old.contrato_inicio then
      if new.contrato_inicio is null
        or (old.contrato_inicio is not null and not coalesce(old.contrato_pendiente,false))
        or exists(select 1 from public.asis_registros where colaborador_id=old.id)
        or exists(select 1 from public.asis_jornadas_vigencias where colaborador_id=old.id and desde<new.contrato_inicio)
        or exists(select 1 from public.asis_horarios_puntuales where colaborador_id=old.id)
        or exists(select 1 from public.asis_excepciones where colaborador_id=old.id)
      then
        raise exception using errcode='P0001',message='inicio_contrato_protegido';
      end if;
    end if;
    for d in 1..7 loop
      a:=coalesce(old.horario_semanal->d::text,'{}'); b:=coalesce(new.horario_semanal->d::text,'{}');
      ma:=coalesce(a->>'mod',case when d=any(old.dias_laborables) then 'virtual' else 'no_gestiona' end);
      mb:=coalesce(b->>'mod',case when d=any(new.dias_laborables) then 'virtual' else 'no_gestiona' end);
      if ma is distinct from mb or (ma<>'no_gestiona' and (
        coalesce(nullif(a->>'ini','')::time,old.hora_inicio),coalesce(nullif(a->>'fin','')::time,old.hora_fin),coalesce(a->>'vinc','practicas'))
        is distinct from (coalesce(nullif(b->>'ini','')::time,new.hora_inicio),coalesce(nullif(b->>'fin','')::time,new.hora_fin),coalesce(b->>'vinc','practicas'))) then
        raise exception using errcode='P0001',message='jornada_requiere_vigencia'; end if;
    end loop;
    -- El guardado anterior normaliza horas y claves. Si no cambia el horario efectivo,
    -- conservar su representación exacta para no registrar una falsa modificación.
    new.horario_semanal:=old.horario_semanal;new.dias_laborables:=old.dias_laborables;
    new.hora_inicio:=old.hora_inicio;new.hora_fin:=old.hora_fin;
  end if;
  return new;
end $$;
revoke all on function public.asis_proteger_jornada() from public,anon,authenticated;
commit;
