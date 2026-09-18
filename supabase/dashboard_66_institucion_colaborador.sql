-- Institución opcional. Aplicar después de dashboard_65.
begin;
alter table public.asis_colaboradores add column if not exists institucion text
  check (institucion is null or char_length(institucion)<=160);

create or replace function public.dash_admin_instituciones()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.asis_es_miembro() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  return jsonb_build_object('ok',true,'personas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'institucion',institucion)) from public.asis_colaboradores),'[]'::jsonb));
end $$;

-- La ficha y su institución se guardan en la misma transacción.
-- Se conservan las validaciones y permisos del guardado existente.
create or replace function public.dash_admin_guardar_ficha(p_datos jsonb,p_motivo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_id bigint; v_before text;
  v_institucion text:=nullif(btrim(p_datos->>'institucion'),'');
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if char_length(v_institucion)>160 then return jsonb_build_object('ok',false,'motivo','institucion'); end if;
  v_result:=public.dash_admin_guardar_colaborador(p_datos,p_motivo);
  if not coalesce((v_result->>'ok')::boolean,false) then return v_result; end if;
  v_id:=(v_result->>'id')::bigint;
  select institucion into v_before from public.asis_colaboradores where id=v_id for update;
  if p_datos ? 'institucion' and v_before is distinct from v_institucion then
    update public.asis_colaboradores set institucion=v_institucion where id=v_id;
    insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
    values(v_id,'otro',jsonb_build_object('institucion',v_before),jsonb_build_object('institucion',v_institucion),
      coalesce(nullif(left(btrim(p_motivo),140),''),'Actualización de institución'),auth.uid());
  end if;
  return v_result;
end $$;
revoke all on function public.dash_admin_instituciones(),public.dash_admin_guardar_ficha(jsonb,text) from public,anon;
grant execute on function public.dash_admin_instituciones(),public.dash_admin_guardar_ficha(jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
