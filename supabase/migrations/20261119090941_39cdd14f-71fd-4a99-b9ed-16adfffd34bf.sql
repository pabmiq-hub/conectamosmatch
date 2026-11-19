create or replace function public.reto_admin_delete_event(_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Solo el superadministrador puede eliminar el Reto';
  end if;
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.table_name like 'reto\_%' and c.column_name = 'event_id'
      and tb.table_type = 'BASE TABLE' and c.table_name <> 'reto_config'
  loop
    execute format('delete from public.%I where event_id = $1', t) using _event;
  end loop;
  delete from public.reto_config where event_id = _event;
end $$;
revoke all on function public.reto_admin_delete_event(uuid) from public, anon;
grant execute on function public.reto_admin_delete_event(uuid) to authenticated;