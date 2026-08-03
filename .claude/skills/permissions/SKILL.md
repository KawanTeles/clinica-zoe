# Skill: permissions

## Objetivo

Garantir que toda funcionalidade nova respeite o modelo de autorização real
do sistema — que vive no Postgres via RLS e `has_role()`, não na UI — e que a
UI apenas reflita essas regras para experiência do usuário.

## Quando utilizar

- Ao criar qualquer tela, rota ou item de menu restrito a um subconjunto de
  papéis.
- Ao adicionar uma tabela nova ou uma nova operação (`SELECT`/`INSERT`/
  `UPDATE`/`DELETE`) em uma tabela existente.
- Ao investigar um bug de "usuário vê/edita dado que não deveria" ou
  "usuário não consegue ver o que deveria".
- Ao implementar qualquer ação administrativa (criar conta, mudar papel,
  desativar, remover usuário).

## Boas práticas

- Trate a política RLS como a especificação formal de "quem pode o quê".
  Ao adicionar uma feature nova, escreva/ajuste a política **antes** de
  escrever a UI que depende dela.
- Use `useAuth().hasRole(role)` / `hasAnyRole([...])` para gates de UI
  (mostrar/esconder menu, redirecionar) — é rápido e já está centralizado.
  Mas isso é **conveniência de UX**, não a barreira de segurança.
- Para ações administrativas sensíveis feitas via server function, sempre
  chame `assertAdmin(supabase, userId)` (ou equivalente) dentro do
  `.handler()`, além de qualquer checagem de UI.
- Ao dar acesso de `PROFISSIONAL` a um recurso, filtre explicitamente pela
  relação `profissionais.user_id = auth.uid()` na query — não dependa
  apenas do RLS silenciosamente cortar linhas; isso deixa a intenção clara
  no código e evita queries que "parecem" trazer tudo.
- Combine papéis quando fizer sentido (`hasAnyRole(["ADMIN",
  "RECEPCIONISTA", "PROFISSIONAL"])`) em vez de checar um a um.

## Más práticas

- Esconder um botão/menu na UI e considerar isso "seguro" sem a política RLS
  correspondente — qualquer pessoa com o token pode chamar a API do Supabase
  diretamente.
- Usar `supabaseAdmin` (service role) em uma server function sem checar
  `assertAdmin` antes — isso bypassa RLS *e* remove a checagem de papel ao
  mesmo tempo.
- Deixar uma tabela nova sem `ENABLE ROW LEVEL SECURITY` "para testar depois"
  — por padrão, sem RLS explícito e sem policy, a tabela fica inacessível
  para `anon`/`authenticated` (comportamento seguro por padrão do Supabase),
  mas é fácil errar isso na migração; sempre habilite e teste as policies
  antes de considerar a tabela pronta.
- Reimplementar `has_role`/`current_user_has_role` em TypeScript para uma
  policy — use as funções SQL já existentes (`SECURITY DEFINER`, evitam
  recursão de RLS).

## Fluxo recomendado

1. Defina os papéis que podem `SELECT`/`INSERT`/`UPDATE`/`DELETE` no recurso.
2. Escreva/atualize as `CREATE POLICY` da tabela usando `has_role(auth.uid(),
   'ADMIN'::app_role)` e/ou comparação de dono (`user_id = auth.uid()`).
3. Se a ação for administrativa e sensível (afeta outro usuário), crie uma
   `createServerFn` com `requireSupabaseAuth` + `assertAdmin` + auditoria
   (`user_audit_log`), em vez de expor a operação como um `update`/`insert`
   direto do client.
4. Filtre a sidebar (`src/components/app-sidebar.tsx`, array `items` com
   `roles: AppRole[]`) e a rota (`hasRole`/`hasAnyRole` + `navigate`) para
   refletir a nova regra na UI.
5. Teste logado como o papel **mais restrito** que deveria ter acesso, e
   depois como um papel que **não deveria** ter acesso (confirme que a
   policy bloqueia, não só a UI).

## Checklist

- [ ] A tabela envolvida tem RLS habilitado e políticas para todas as
      operações que a UI vai fazer?
- [ ] Testei o cenário negativo (usuário sem o papel tentando acessar via
      API, não só via UI escondida)?
- [ ] Ações administrativas sensíveis passam por `assertAdmin` no server e
      geram registro em `user_audit_log`?
- [ ] `PROFISSIONAL` só vê dados vinculados ao seu próprio
      `profissionais.user_id`?
- [ ] O item de menu/rota nova está com o array `roles` correto em
      `app-sidebar.tsx`?

## Regras obrigatórias

- 4 papéis oficiais: `ADMIN`, `RECEPCIONISTA`, `PROFISSIONAL`, `CLIENTE`
  (enum `public.app_role`). Não introduza um novo "papel" fora desse enum
  sem migração explícita e revisão de todas as policies afetadas.
- Um usuário pode ter múltiplos papéis simultâneos (`user_roles` é 1:N).
  Código que assume "um usuário, um papel" está incorreto — use
  `roles[0]` apenas para exibição (ex.: badge no header), nunca para lógica
  de permissão.
- `ADMIN` sempre tem acesso total nas policies existentes — ao escrever uma
  policy nova, inclua `has_role(auth.uid(), 'ADMIN')` no `OR` a menos que
  haja uma razão explícita para excluir até o ADMIN.

## Arquivos normalmente envolvidos

- `supabase/portable/02_schema_public.sql` — todas as `CREATE POLICY`
  atuais (buscar por `CREATE POLICY`).
- `src/lib/auth-context.tsx` — `hasRole`, `hasAnyRole`, `AppRole`.
- `src/components/app-sidebar.tsx` — matriz de papel → item de menu.
- `src/lib/users.server.ts`, `src/lib/admin.functions.ts` — `assertAdmin`,
  auditoria.

## Erros comuns

- Escrever uma policy `USING (true)` "temporariamente" e esquecer de
  restringir depois.
- Esquecer o `WITH CHECK` em policies de `UPDATE`/`INSERT` — `USING` sozinho
  não impede que a linha seja escrita com valores fora da regra.
- Dar a `PROFISSIONAL` acesso de leitura a `pacientes` sem o `EXISTS` que
  liga o paciente a um agendamento com aquele profissional (ver a policy
  `pac_read` como referência de padrão correto).

## Exemplos

Ver `examples.md`.

## Observações

A tabela `user_roles` é a única fonte de verdade de papel — `profiles` só
guarda dados de perfil (nome, foto, status ativo). Nunca infira papel a
partir de outra tabela (ex.: "tem linha em `profissionais`, logo é
PROFISSIONAL") — sempre confira `user_roles`.
