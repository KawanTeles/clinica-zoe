# Exemplos — permissions

## 1. Policy combinando papel fixo + relação de dono

`profissional_bloqueio` (RLS real do projeto, `supabase/portable/02_schema_public.sql`):

```sql
CREATE POLICY bloq_delete ON public.profissional_bloqueio
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.profissionais p
      WHERE p.id = profissional_bloqueio.profissional_id
        AND p.user_id = auth.uid()
    )
  );
```

Padrão a seguir para qualquer tabela nova ligada a `profissionais`: ADMIN
sempre pode, e o dono (`user_id = auth.uid()`) também pode — nada mais.

## 2. Leitura de pacientes restrita por vínculo com agendamento

```sql
CREATE POLICY pac_read ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role)
    OR user_id = auth.uid()
    OR (
      public.has_role(auth.uid(), 'PROFISSIONAL'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.agendamentos a
        JOIN public.profissionais p ON p.id = a.profissional_id
        WHERE a.paciente_id = pacientes.id AND p.user_id = auth.uid()
      )
    )
  );
```

Um `PROFISSIONAL` só enxerga um paciente se existir (existiu) um
agendamento entre os dois — não é "todo profissional vê todo paciente".

## 3. Sidebar filtrando por papel

`src/components/app-sidebar.tsx`:

```ts
const items: Item[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, roles: ["ADMIN"] },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays, roles: ["ADMIN", "RECEPCIONISTA"], badge: "agenda" },
  { title: "Minha Agenda", url: "/app/minha-agenda", icon: CalendarDays, roles: ["PROFISSIONAL"], badge: "agenda" },
  { title: "Usuários", url: "/app/usuarios", icon: UserCog, roles: ["ADMIN"] },
];
// ...
const visible = items.filter((i) => i.roles.some((r) => roles.includes(r)));
```

Isso é só UX — a proteção real de `/app/usuarios` está no guard da rota
(`hasRole("ADMIN")` + `navigate({ to: "/app" })`) **e**, mais importante, nas
`createServerFn` (`adminListUsers` etc.) que chamam `assertAdmin`.

## 4. Ação administrativa sensível com auditoria

`src/lib/users.server.ts`:

```ts
export async function setUserActive(actorId: string, targetId: string, ativo: boolean) {
  const { error } = await supabaseAdmin.from("profiles").update(/* ... */).eq("id", targetId);
  if (error) throw new Error(error.message);

  await supabaseAdmin.auth.admin.updateUserById(targetId, {
    ban_duration: ativo ? "none" : "876000h",
  } as any);

  await registrarAuditoria({
    actorId, targetId,
    acao: ativo ? "USUARIO_REATIVADO" : "USUARIO_DESATIVADO",
    detalhes: ativo ? "Conta reativada; acesso liberado." : "Conta desativada; login bloqueado e histórico preservado.",
  });
}
```

Qualquer ação administrativa nova que afete outro usuário deve seguir este
padrão: efeito no banco → efeito no Supabase Auth (se aplicável) → registro
em `user_audit_log`.
