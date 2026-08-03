# Exemplos — debugging

## 1. Interpretando um erro de trigger como mensagem direta ao usuário

Se `insert` em `agendamentos` falha com:

```
error.message === "Conflito de horário: já existe um agendamento neste intervalo."
```

Isso vem literalmente do `RAISE EXCEPTION` em
`check_agendamento_conflito()` — não é um bug, é a validação funcionando. A
correção correta é garantir que a UI mostra essa mensagem
(`toast.error(e?.message ?? "Falha ao criar")`), não tentar "consertar" o
insert para ele passar mesmo com conflito.

## 2. Diagnosticando "dado não atualiza" por `queryKey` divergente

Sintoma: usuário aprova uma solicitação em `app.solicitacoes.tsx`, mas o
badge da sidebar continua mostrando o número antigo.

Verifique se a mutação invalida a `queryKey` exata usada pelo hook do badge:

```ts
// src/lib/sidebar-badges.ts
useQuery({ queryKey: ["sidebar-badges", session?.user?.id, canFinanceiro], ... });
```

Se a mutação em `app.solicitacoes.tsx` só invalidar `["solicitacoes"]` e
`["dashboard-stats"]`, mas não `["sidebar-badges"]`, o badge fica preso até
o `refetchInterval: 30_000` disparar. A correção é adicionar a invalidação
que falta, não reduzir o intervalo de polling como gambiarra.

## 3. Recuperando o stack trace real de um 500 SSR "engolido" pelo h3

`src/server.ts` documenta explicitamente esse problema:

```ts
// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  // ...
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), { status: 500, ... });
}
```

Se você vir a página genérica "This page didn't load" em produção, o erro
real foi impresso via `console.error` nesse ponto — procure nos logs do
runtime (Cloudflare/Vercel/Netlify), não só no response HTTP, que só mostra
a página de fallback.

## 4. Diagnosticando bug de permissão testando a policy diretamente

Ao investigar "PROFISSIONAL não vê um paciente que deveria ver", reproduza a
policy manualmente no SQL editor do Supabase, autenticado como aquele
usuário (ou simulando `auth.uid()`), antes de mexer em qualquer código
React:

```sql
-- confirma se a relação profissional → agendamento → paciente existe de fato
SELECT 1 FROM public.agendamentos a
JOIN public.profissionais p ON p.id = a.profissional_id
WHERE a.paciente_id = '<id-do-paciente>' AND p.user_id = '<id-do-profissional>';
```

Se essa consulta não retorna linha, o problema é de dado (agendamento nunca
foi criado ligando os dois) — não de policy nem de frontend.
