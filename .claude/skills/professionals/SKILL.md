# Skill: professionals

## Objetivo

Orientar mudanças no cadastro de profissionais, seus valores de consulta,
disponibilidade/bloqueios e a exposição pública (site) desses dados.

## Quando utilizar

- Ao alterar `src/routes/app.profissionais.tsx` (CRUD ADMIN) ou
  `src/routes/app.meu-perfil.tsx` (autoedição pelo PROFISSIONAL).
- Ao mexer em valores de consulta (`valor_consulta_avista`,
  `valor_consulta_cartao`), duração (`duracao_consulta_min`) ou status
  (`ATIVO`/`INATIVO`).
- Ao alterar o que aparece na página pública `src/routes/profissionais.tsx`
  ou no seletor do wizard de agendamento.
- Ao investigar por que um profissional some/aparece no site público.

## Boas práticas

- Toda leitura pública (site, wizard de agendamento) usa a view
  `profissionais_public` (`status = 'ATIVO'` e apenas colunas seguras) — não
  faça `select("*")` na tabela `profissionais` a partir de uma rota
  anônima.
- `status = 'INATIVO'` é o mecanismo padrão para "esconder do site sem
  apagar histórico" — nunca delete um profissional que já tem
  `agendamentos`/`financeiro` associados; desative.
- Ao criar um profissional pela tela de Usuários (`adminCreateUser`), os
  campos de valor/duração seguem o schema `zod` de
  `src/lib/admin.functions.ts` (`profissional` opcional dentro do payload)
  — reuse esse contrato em vez de criar um segundo formulário de criação de
  profissional isolado.
- `resolve_valor_consulta` (SQL) já decide entre `valor_consulta_avista` e
  `valor_consulta_cartao` conforme a forma de pagamento, com fallback para o
  outro valor se um estiver zerado — replique essa mesma prioridade em
  qualquer exibição de "preço estimado" no client, para não mostrar um valor
  diferente do que será congelado na aprovação.
- Autoedição do próprio profissional (`meu-perfil.tsx`) é permitida pela
  policy `prof_admin_or_self_update` — mantenha essa tela restrita aos
  campos que fazem sentido o próprio profissional editar (foto, descrição,
  formação), não exponha campos administrativos (status, criação de
  usuário) nela.

## Más práticas

- Deletar um `profissional` diretamente — quebra referências históricas em
  `agendamentos.profissional_id`/`financeiro.profissional_id`. Use
  `status = 'INATIVO'` (e, se o usuário de login for removido,
  `removeUser` já cuida de setar `status: 'INATIVO', user_id: null`
  automaticamente).
- Expor `email`/`telefone` interno do profissional na página pública — a
  view `profissionais_public` já omite esses campos; não crie uma query
  paralela que os exponha por engano.
- Ignorar `duracao_consulta_min` ao montar qualquer UI de agenda —
  todo cálculo de `hora_fim`/slots depende desse valor por profissional
  (default 60 no cadastro, mas 30 é o fallback de `horarios_disponiveis`
  quando nulo).

## Fluxo recomendado

1. **Criar profissional**: preferencialmente via `adminCreateUser`
   (cria conta + papel `PROFISSIONAL` + linha em `profissionais` em uma
   única operação transacional no server) — não crie a conta separada da
   linha de `profissionais`.
2. **Disponibilidade inicial**: automática via trigger
   `seed_disponibilidade_padrao` ao inserir em `profissionais` — não
   duplique esse seed na aplicação.
3. **Editar valores/dados**: `app.profissionais.tsx` (ADMIN) ou
   `app.meu-perfil.tsx` (o próprio profissional, campos limitados).
4. **Desativar**: via `adminSetUserActive` (desativa a conta **e** marca
   `profissionais.status = 'INATIVO'` automaticamente) — não desative só a
   conta sem tratar o status do profissional, nem vice-versa.

## Checklist

- [ ] Leitura pública usa `profissionais_public`, não a tabela crua?
- [ ] Novo profissional foi criado com conta + papel + linha em
      `profissionais` de forma consistente?
- [ ] "Remoção" foi implementada como `status = 'INATIVO'`, não `DELETE`?
- [ ] Cálculo de preço no client é consistente com `resolve_valor_consulta`?
- [ ] Autoedição do profissional não expõe campos administrativos?

## Regras obrigatórias

- Valor de consulta nunca é decidido só no client no momento da aprovação —
  é a função `resolve_valor_consulta` (via trigger
  `set_agendamento_valor_congelado`) que congela o valor final.
- `profissionais.user_id` é o vínculo usado por todas as policies de "dono"
  (`p.user_id = auth.uid()`) — nunca fique `null` para um profissional
  ativo com conta de login válida.

## Arquivos normalmente envolvidos

- `src/routes/app.profissionais.tsx`, `app.meu-perfil.tsx`,
  `src/routes/profissionais.tsx` (site público)
- `src/lib/profissionais-public.tsx`
- `src/lib/admin.functions.ts` (`adminCreateUser`, ramo `profissional`)
- Tabela `public.profissionais`, view `profissionais_public`, tabelas
  `profissional_disponibilidade`, `profissional_bloqueio`.

## Erros comuns

- Esquecer que `especialidade_id` é opcional (`nullable`) — telas que
  assumem sempre haver especialidade quebram para cadastros incompletos.
- Comparar `status` como string livre em vez do enum `profissional_status`
  (`ATIVO`/`INATIVO`) — atenção a maiúsculas/minúsculas.
- Duplicar a lógica de fallback de valor (`avista` vs `cartao`) de forma
  diferente da função SQL, gerando preço mostrado ≠ preço cobrado.

## Exemplos

Ver `examples.md`.

## Observações

`anos_experiencia`, `formacao`, `registro_profissional` são campos de
apresentação institucional (usados no site público) — trate-os como
conteúdo editorial, não dado transacional.
