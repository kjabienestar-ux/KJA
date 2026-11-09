begin;
-- KJA-032: endpoints adicionales de solo lectura. No cambia funciones existentes ni datos.
-- SECURITY DEFINER conserva el acceso autorizado de las RPC originales sobre tablas privadas.
-- Se exige identidad y autorización en cada llamada; PUBLIC/anon sin EXECUTE; relaciones calificadas.

create or replace function public.dash_admin_historial_colaborador_pagina(p_colab bigint,p_antes jsonb default null,p_limite integer default 12)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_rows jsonb;v_items jsonb;v_persona jsonb;v_review boolean:=false;
 v_limit integer:=greatest(1,least(coalesce(p_limite,12),50));
 v_fecha timestamptz;v_id bigint;v_next jsonb;
begin
 if auth.uid() is null or not public.asis_es_miembro() then
   return jsonb_build_object('ok',false,'motivo','sin_permiso');
 end if;
 if p_antes is not null then
   begin
     v_fecha:=(p_antes->>'fecha')::timestamptz;v_id:=(p_antes->>'id')::bigint;
     if v_fecha is null or v_id is null then return jsonb_build_object('ok',false,'motivo','cursor');end if;
   exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
     return jsonb_build_object('ok',false,'motivo','cursor');
   end;
 end if;
 select jsonb_build_object('id',c.id,'nombre',c.nombre,'area',a.nombre,'saldo',c.dias_libres_saldo)
 into v_persona from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id where c.id=p_colab;
 if v_persona is null then return jsonb_build_object('ok',false,'motivo','no_existe');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'fecha',h.fecha,'tipo',h.tipo,'nota',h.nota,'horario_anterior',h.horario_anterior,'horario_nuevo',h.horario_nuevo,'horas_anterior',h.horas_anterior,'horas_nueva',h.horas_nueva,'created_at',h.created_at,'creado_por',p.nombre,'_cursor',jsonb_build_object('fecha',h.created_at,'id',h.id::text)) order by h.created_at desc,h.id desc),'[]'::jsonb)
 into v_rows from (
   select * from public.asis_historial_contrato t where t.colaborador_id=p_colab
   and (p_antes is null or (t.created_at,t.id)<(v_fecha,v_id))
   order by t.created_at desc,t.id desc limit v_limit+1
 ) h left join public.asis_perfiles p on p.id=h.creado_por;
 select coalesce(jsonb_agg(value-'_cursor' order by ordinal),'[]'::jsonb) into v_items
 from jsonb_array_elements(v_rows) with ordinality as row(value,ordinal) where ordinal<=v_limit;
 if jsonb_array_length(v_rows)>v_limit then v_next:=v_rows->(v_limit-1)->'_cursor';end if;
 select exists(select 1 from public.asis_historial_contrato h
   where h.colaborador_id=p_colab and h.tipo='horas_contrato' and exists(
     select 1 from public.asis_historial_contrato x where x.colaborador_id=p_colab
       and x.tipo in ('horario','fechas') and x.created_at=h.created_at)) into v_review;
 return jsonb_build_object('ok',true,'historial',v_items,'siguiente',v_next,'revisar_meta',v_review);
end;
$$;
revoke all on function public.dash_admin_historial_colaborador_pagina(bigint,jsonb,integer) from public,anon;
grant execute on function public.dash_admin_historial_colaborador_pagina(bigint,jsonb,integer) to authenticated;

create or replace function public.dash_admin_dias_libres_pagina(p_colab bigint,p_antes jsonb default null,p_limite integer default 12)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_rows jsonb;v_items jsonb;v_persona jsonb;v_review boolean:=false;
 v_limit integer:=greatest(1,least(coalesce(p_limite,12),50));
 v_fecha timestamptz;v_id bigint;v_next jsonb;
begin
 if auth.uid() is null or public.asis_rol() is distinct from 'direccion' then
   return jsonb_build_object('ok',false,'motivo','sin_permiso');
 end if;
 if p_antes is not null then
   begin
     v_fecha:=(p_antes->>'fecha')::timestamptz;v_id:=(p_antes->>'id')::bigint;
     if v_fecha is null or v_id is null then return jsonb_build_object('ok',false,'motivo','cursor');end if;
   exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
     return jsonb_build_object('ok',false,'motivo','cursor');
   end;
 end if;
 select jsonb_build_object('id',c.id,'nombre',c.nombre,'area',a.nombre,'saldo',c.dias_libres_saldo)
 into v_persona from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id where c.id=p_colab;
 if v_persona is null then return jsonb_build_object('ok',false,'motivo','no_existe');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'cantidad',m.cantidad,'saldo_anterior',m.saldo_anterior,'saldo_resultante',m.saldo_resultante,'motivo',m.motivo,'solicitud_id',m.solicitud_id,'creado_at',m.creado_at,'actor',coalesce(p.nombre,'Dirección'),'_cursor',jsonb_build_object('fecha',m.creado_at,'id',m.id::text)) order by m.creado_at desc,m.id desc),'[]'::jsonb)
 into v_rows from (
   select * from public.asis_dias_libres_movimientos t where t.colaborador_id=p_colab
   and (p_antes is null or (t.creado_at,t.id)<(v_fecha,v_id))
   order by t.creado_at desc,t.id desc limit v_limit+1
 ) m left join public.asis_perfiles p on p.id=m.creado_por;
 select coalesce(jsonb_agg(value-'_cursor' order by ordinal),'[]'::jsonb) into v_items
 from jsonb_array_elements(v_rows) with ordinality as row(value,ordinal) where ordinal<=v_limit;
 if jsonb_array_length(v_rows)>v_limit then v_next:=v_rows->(v_limit-1)->'_cursor';end if;

 return jsonb_build_object('ok',true,'movimientos',v_items,'siguiente',v_next,'revisar_meta',v_review,'persona',v_persona);
end;
$$;
revoke all on function public.dash_admin_dias_libres_pagina(bigint,jsonb,integer) from public,anon;
grant execute on function public.dash_admin_dias_libres_pagina(bigint,jsonb,integer) to authenticated;

commit;
