# Exemplos — clinic-architecture

## 1. Dois clientes Supabase isolados por área

`src/integrations/supabase/dual-client.ts` define `STORAGE_KEYS` e resolve o
cliente certo pela URL:

```ts
const STORAGE_KEYS: Record<AuthScope, string> = {
  staff: "zoe-auth-staff",
  client: "zoe-auth-client",
};

export function scopeForPath(pathname: string): AuthScope {
  if (pathname === "/app" || pathname.startsWith("/app/")) return "staff";
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return "staff";
  return "client";
}
```

Isso é consumido em `src/lib/auth-context.tsx`, que recalcula o `scope`
sempre que a rota muda (`useRouterState`) e reseta sessão/papéis ao trocar de
área.

## 2. Componente de feature reaproveitado entre duas rotas do Painel

`src/components/agenda/AgendaView.tsx` é usado tanto em
`src/routes/app.agenda.tsx` (visão ADMIN/RECEPCIONISTA, todos os
profissionais) quanto em `src/routes/app.minha-agenda.tsx` (visão travada no
profissional logado), variando apenas as props:

```tsx
// app.agenda.tsx (visão geral)
<AgendaView allowSelectProfissional title="Agenda" />

// app.minha-agenda.tsx (visão do profissional)
<AgendaView scopedProfissionalId={meuProfissionalId} allowSelectProfissional={false} />
```

## 3. Regra de negócio crítica vivendo no banco, não no client

`check_agendamento_conflito()` (trigger `BEFORE INSERT OR UPDATE` em
`public.agendamentos`) recusa a escrita se houver sobreposição de horário,
bloqueio ou fora da disponibilidade — mesmo que a UI de
`src/components/agenda/AgendaView.tsx` faça um `insert` direto pelo client
Supabase:

```sql
CREATE TRIGGER trg_check_agendamento_conflito
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.check_agendamento_conflito();
```

O componente apenas trata o erro retornado (`error.message`) e mostra via
`toast.error(...)` — não reimplementa a checagem de conflito em JS.

## 4. Fluxo completo de uma feature (Solicitações → Financeiro → Notificação)

1. Paciente cria `agendamentos` (status `PENDENTE`) em `agendamento.tsx`
   (site público, escopo `client`).
2. Trigger `trg_agendamento_notify_ins` enfileira notificação interna e
   WhatsApp para o profissional/recepção.
3. Equipe aprova em `src/routes/app.solicitacoes.tsx` (escopo `staff`),
   atualizando `status = 'APROVADO'`.
4. Trigger `trg_on_agendamento_aprovado` cria a linha correspondente em
   `public.financeiro`.
5. Trigger `trg_agendamento_notify_upd` notifica o paciente da confirmação.
6. `src/lib/sidebar-badges.ts` (via `useQuery` com `refetchInterval: 30_000`)
   atualiza os contadores da sidebar sem que nenhuma linha de código explícita
   precise "avisar" a sidebar — é polling + invalidação de query, não
   realtime.
