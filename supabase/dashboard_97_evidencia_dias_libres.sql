-- Aplicar después de dashboard_96. Comprobante obligatorio por envío.
begin;
do $$ begin
 if to_regprocedure('public.dash_crear_solicitud_base_97(text,date,date,text,text)') is null then
  alter function public.dash_crear_solicitud(text,date,date,text,text) rename to dash_crear_solicitud_base_97;
 end if;
end $$;
revoke all on function public.dash_crear_solicitud_base_97(text,date,date,text,text) from public,anon,authenticated;
drop function if exists public.dash_solicitar_dias_libres(date[],text);
create or replace function public.dash_crear_solicitud(p_tipo text,p_fecha_inicio date,p_fecha_fin date,p_detalle text,p_evidencia text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if btrim(coalesce(p_tipo,''))='dia_libre' then return jsonb_build_object('ok',false,'motivo','evidencia'); end if;
 return public.dash_crear_solicitud_base_97(p_tipo,p_fecha_inicio,p_fecha_fin,p_detalle,p_evidencia);
end $$;
create or replace function public.dash_solicitar_dias_libres(p_fechas date[],p_detalle text default null,p_evidencia text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_id bigint:=public.dash_colab();
  v_grupo uuid:=gen_random_uuid();
  v_saldo integer;
  v_fecha date;
  v_resultado jsonb;
  v_ids jsonb:='[]'::jsonb;
  v_cantidad integer:=cardinality(p_fechas);
begin
  if auth.uid() is null or not coalesce(public.dash_sesion_vigente(),false) or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if v_cantidad is null or v_cantidad not between 1 and 365
    or exists(select 1 from unnest(p_fechas) f where f is null)
    or (select count(distinct f) from unnest(p_fechas) f)<>v_cantidad then
    return jsonb_build_object('ok',false,'motivo','fechas');
  end if;
  select dias_libres_saldo into v_saldo from public.asis_colaboradores where id=v_id and activo for update;
  if not found then return jsonb_build_object('ok',false,'motivo','colaborador'); end if;
  if v_saldo-public.asis_dias_libres_reservados(v_id)<v_cantidad then
    return jsonb_build_object('ok',false,'motivo','saldo_insuficiente');
  end if;
  if p_evidencia is null or p_evidencia !~ ('^'||v_id::text||'/[0-9a-f-]+\.(jpg|webp)$')
    or not exists(select 1 from storage.objects where bucket_id='solicitud-evidencias' and name=p_evidencia)
    or public.dash_solicitud_evidencia_en_uso(p_evidencia) then
    return jsonb_build_object('ok',false,'motivo','evidencia');
  end if;
  -- El subbloque revierte todo el lote si falla cualquiera de las fechas.
  begin
    for v_fecha in select f from unnest(p_fechas) f order by f loop
      v_resultado:=public.dash_crear_solicitud_base_97('dia_libre',v_fecha,v_fecha,
        coalesce(nullif(btrim(p_detalle),''),'Solicitud de día libre para '||v_fecha::text),null);
      if not coalesce((v_resultado->>'ok')::boolean,false) then
        v_resultado:=v_resultado||jsonb_build_object('fecha',v_fecha);
        raise exception using errcode='P0095',message='lote_dias_libres_invalido';
      end if;
      update public.asis_solicitudes_personales set solicitud_grupo=v_grupo where id=(v_resultado->>'id')::bigint;
      v_ids:=v_ids||jsonb_build_array(v_resultado->'id');
    end loop;
  exception when sqlstate 'P0095' then return v_resultado;
  end;
  update public.asis_solicitudes_personales set evidencia_path=p_evidencia where id=(v_ids->>0)::bigint;
  return jsonb_build_object('ok',true,'ids',v_ids,'cantidad',v_cantidad,'grupo',v_grupo);
end $$;
revoke all on function public.dash_solicitar_dias_libres(date[],text,text),public.dash_crear_solicitud(text,date,date,text,text) from public,anon,authenticated;
grant execute on function public.dash_solicitar_dias_libres(date[],text,text),public.dash_crear_solicitud(text,date,date,text,text) to authenticated;
notify pgrst,'reload schema';
commit;