# Skill: security

## Objetivo

Consolidar num só lugar as regras de segurança que atravessam todas as
outras skills — chaves, autenticação de server functions, RLS,
auditoria — como referência rápida antes de qualquer mudança sensível.

## Quando utilizar

- Antes de qualquer mudança que toque autenticação, papéis, dados de outro
  usuário, ou chaves/segredos.
- Ao revisar código de terceiros/gerado antes de aceitar (ex.: uma sugestão
  de PR ou snippet externo).
- Ao adicionar uma dependência nova que lida com dados sensíveis.

## Boas práticas

- **Segregação de chave**: `SUPABASE_SERVICE_ROLE_KEY` só existe em
  `*.server.ts`, nunca em `*.functions.ts`, componente ou rota — e só é
  importada dinamicamente (`await import(...)`) de dentro do `.handler()`
  de uma `createServerFn`. Ver [[supabase]].
- **Autenticação de server function**: toda `createServerFn` que precisa
  saber quem é o usuário usa `.middleware([requireSupabaseAuth])` — que
  valida o Bearer token via `supabase.auth.getClaims(token)` no server, não
  confia em um `user_id` enviado no payload.
- **Autorização em duas camadas**: UI esconde o que o usuário não deveria
  ver (conveniência); RLS/`assertAdmin` no server é o que realmente impede
  o acesso. Nenhuma camada substitui a outra. Ver [[permissions]].
- **Auditoria**: toda ação administrativa sensível (criar conta, mudar
  papel, desativar, remover usuário) grava em `user_audit_log` via
  `registrarAuditoria`/`registrarAuditoriaExterna` — inclua isso em
  qualquer ação nova do mesmo tipo.
- **Mensagens de erro**: login usa mensagem genérica
  (`"Credenciais inválidas"`) como fallback — não exponha se um e-mail
  existe ou não no sistema.
- **Storage privado**: buckets (`profissionais`, `clientes`, `clinica`) são
  privados; acesso via Signed URL de curta duração — nunca torne um bucket
  público para simplificar uma feature.
- **SQL**: toda função `SECURITY DEFINER` tem `SET search_path TO 'public'`
  explícito — mitigação padrão contra sequestro de `search_path` no
  Postgres. Nunca crie uma função `SECURITY DEFINER` sem isso.

## Más práticas

- Aceitar um `user_id`/`role` vindo do corpo de uma requisição do client
  sem revalidar contra o token/servidor.
- Desabilitar RLS "temporariamente" para debugar em produção.
- Logar payloads inteiros de request/response que podem conter senha, token
  ou dado clínico sensível.
- Tornar uma policy `USING (true)` ampla demais só para destravar uma
  feature rapidamente, com plano de "restringir depois" — isso vaza dado
  imediatamente, mesmo que por pouco tempo.
- Reativar um usuário, mudar papel ou acessar dado de outro usuário sem
  passar por `assertAdmin` — mesmo que a UI já esconda a opção.

## Fluxo recomendado (revisão de segurança de uma mudança)

1. A mudança toca dado de outro usuário, papel ou chave sensível? Se sim,
   pare e aplique os próximos passos; se não, siga o fluxo normal.
2. Confirme a policy RLS da(s) tabela(s) envolvida(s) cobre exatamente o
   caso de uso, nem mais nem menos.
3. Se é uma operação administrativa, confirme `requireSupabaseAuth` +
   `assertAdmin` (ou equivalente) no server, e registro em
   `user_audit_log`.
4. Confirme que nenhuma chave/segredo aparece em código client-visível
   (`*.functions.ts`, componentes, rotas) — só em `*.server.ts`.
5. Teste o caminho negativo: um usuário sem permissão tentando a operação
   diretamente (não só escondida na UI).

## Checklist

- [ ] Nenhuma chave sensível em código client-visível?
- [ ] Server function sensível protegida por `requireSupabaseAuth` +
      checagem de papel explícita no handler?
- [ ] RLS cobre exatamente o necessário, sem `USING (true)` amplo demais?
- [ ] Ação administrativa sensível gera registro em `user_audit_log`?
- [ ] Testado o caminho negativo (acesso negado a quem não deveria)?

## Regras obrigatórias

- `SUPABASE_SERVICE_ROLE_KEY` nunca com prefixo `VITE_`, nunca fora de
  `*.server.ts`.
- Toda `createServerFn` sensível valida entrada com `zod` antes de tocar o
  banco.
- Toda função SQL `SECURITY DEFINER` tem `SET search_path TO 'public'`.

## Arquivos normalmente envolvidos

- `src/integrations/supabase/client.server.ts`,
  `src/integrations/supabase/auth-middleware.ts`
- `src/lib/*.server.ts`, `src/lib/*.functions.ts`
- Tabela `public.user_audit_log`

## Erros comuns

- Confundir "a UI não mostra o botão" com "a operação está protegida" —
  ver [[permissions]] para o modelo correto.
- Esquecer que `context.userId` do middleware é a única fonte confiável de
  identidade em uma server function — nunca reusar um `userId` vindo de
  `data` (payload) para decisão de autorização.

## Exemplos

Ver `examples.md`.

## Observações

Ver também [[permissions]] (modelo de autorização) e [[supabase]]
(separação client/server) — esta skill é o resumo consolidado das duas sob
a lente de segurança.
