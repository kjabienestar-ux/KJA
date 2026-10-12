-- Correo de contacto opcional y único del colaborador. Aplicar después de dashboard_112.
begin;
alter table public.asis_colaboradores add column if not exists correo text
  check (correo is null or (char_length(correo)<=120 and correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
create unique index if not exists asis_colaboradores_correo_uq
  on public.asis_colaboradores (lower(correo)) where correo is not null;

create or replace function public.dash_admin_instituciones()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.asis_es_miembro() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  return jsonb_build_object('ok',true,'personas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'institucion',institucion,'correo',correo)) from public.asis_colaboradores),'[]'::jsonb));
end $$;

-- Igual que dashboard_66, más el correo. Se valida antes del guardado base
-- para no dejar la ficha guardada a medias si el correo es inválido o repetido.
create or replace function public.dash_admin_guardar_ficha(p_datos jsonb,p_motivo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_id bigint; v_before text; v_before_correo text;
  v_institucion text:=nullif(btrim(p_datos->>'institucion'),'');
  v_correo text:=nullif(lower(btrim(p_datos->>'correo')),'');
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if char_length(v_institucion)>160 then return jsonb_build_object('ok',false,'motivo','institucion'); end if;
  if v_correo is not null then
    if char_length(v_correo)>120 or v_correo !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      return jsonb_build_object('ok',false,'motivo','correo');
    end if;
    if exists(select 1 from public.asis_colaboradores
              where lower(correo)=v_correo and id is distinct from nullif(p_datos->>'id','')::bigint) then
      return jsonb_build_object('ok',false,'motivo','correo_duplicado');
    end if;
  end if;
  v_result:=public.dash_admin_guardar_colaborador(p_datos,p_motivo);
  if not coalesce((v_result->>'ok')::boolean,false) then return v_result; end if;
  v_id:=(v_result->>'id')::bigint;
  select institucion,correo into v_before,v_before_correo from public.asis_colaboradores where id=v_id for update;
  if p_datos ? 'institucion' and v_before is distinct from v_institucion then
    update public.asis_colaboradores set institucion=v_institucion where id=v_id;
    insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
    values(v_id,'otro',jsonb_build_object('institucion',v_before),jsonb_build_object('institucion',v_institucion),
      coalesce(nullif(left(btrim(p_motivo),140),''),'Actualización de institución'),auth.uid());
  end if;
  if p_datos ? 'correo' and v_before_correo is distinct from v_correo then
    update public.asis_colaboradores set correo=v_correo where id=v_id;
  end if;
  return v_result;
end $$;
revoke all on function public.dash_admin_instituciones(),public.dash_admin_guardar_ficha(jsonb,text) from public,anon;
grant execute on function public.dash_admin_instituciones(),public.dash_admin_guardar_ficha(jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
