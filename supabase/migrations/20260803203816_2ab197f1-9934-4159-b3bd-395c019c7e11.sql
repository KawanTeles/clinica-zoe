drop policy if exists financeiro_anexos_staff_select on storage.objects;
create policy financeiro_anexos_staff_select on storage.objects for select to authenticated
using (bucket_id = 'financeiro' and (has_role(auth.uid(),'ADMIN'::app_role) or has_role(auth.uid(),'RECEPCIONISTA'::app_role)));

drop policy if exists financeiro_anexos_staff_insert on storage.objects;
create policy financeiro_anexos_staff_insert on storage.objects for insert to authenticated
with check (bucket_id = 'financeiro' and (has_role(auth.uid(),'ADMIN'::app_role) or has_role(auth.uid(),'RECEPCIONISTA'::app_role)));

drop policy if exists financeiro_anexos_admin_delete on storage.objects;
create policy financeiro_anexos_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'financeiro' and has_role(auth.uid(),'ADMIN'::app_role));