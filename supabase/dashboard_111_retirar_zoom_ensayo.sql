-- Retira exclusivamente el ensayo del portal; no llama ni elimina nada en Zoom.
-- Ejecutar en SQL Editor después de 110.
begin;
do $$
declare v public.zoom_reuniones%rowtype;
begin
 select * into v from public.zoom_reuniones
 where zoom_id='97989276624' for update;
 if not found or v.status='cancelled' then return; end if;
 if v.busy_until > now() then
  raise exception 'Hay una operación en curso sobre el ensayo. Espera dos minutos y vuelve a ejecutar.';
 end if;
 update public.zoom_reuniones
 set status='cancelled', join_url=null, revision=revision+1,
 operation_id=null, busy_until=null, last_error=null, updated_at=now()
 where id=v.id;
 delete from public.zoom_operadores where reunion_id=v.id;
 insert into public.zoom_eventos(reunion_id,actor_id,action,result)
 values(v.id,null,'retire_test_portal','completed');
end;
$$;
commit;
