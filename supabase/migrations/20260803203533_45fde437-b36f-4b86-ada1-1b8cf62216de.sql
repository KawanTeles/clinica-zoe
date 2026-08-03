create or replace function public.profissional_atende_usuario(_prof_user_id uuid, _paciente_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agendamentos a
    join public.profissionais pr on pr.id = a.profissional_id
    left join public.pacientes pa on pa.id = a.paciente_id
    where pr.user_id = _prof_user_id
      and (pa.user_id = _paciente_user_id or a.cliente_user_id = _paciente_user_id)
  );
$$;

revoke all on function public.profissional_atende_usuario(uuid, uuid) from public;
grant execute on function public.profissional_atende_usuario(uuid, uuid) to authenticated;

drop policy if exists "clientes_read_own_or_staff" on storage.objects;

create policy "clientes_read_own_or_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'clientes'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or has_role(auth.uid(), 'ADMIN'::app_role)
    or has_role(auth.uid(), 'RECEPCIONISTA'::app_role)
    or (
      has_role(auth.uid(), 'PROFISSIONAL'::app_role)
      and public.profissional_atende_usuario(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);