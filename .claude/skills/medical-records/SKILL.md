# Skill: medical-records

## Objetivo

Documentar o estado **real** (e limitado) de registro clínico no sistema
hoje, e estabelecer como estender essa funcionalidade seguindo os padrões
já usados no projeto, caso um módulo de prontuário estruturado seja
solicitado no futuro.

## Quando utilizar

- Antes de prometer/implementar qualquer funcionalidade de "prontuário",
  "histórico clínico" ou "anotações de consulta" — para saber exatamente o
  que já existe e o que precisa ser criado do zero.
- Ao receber um pedido de feature que menciona "ficha do paciente",
  "evolução clínica" ou similar.

## Estado atual do projeto (importante)

Não existe um módulo de prontuário eletrônico estruturado. O que existe:

- `public.pacientes.observacoes` — um único campo de texto livre por
  paciente (não versionado, não vinculado a uma consulta específica).
  Editado em `src/routes/app.pacientes.tsx`.
- `public.agendamentos.observacoes` — texto livre por agendamento
  (contexto da marcação, não uma evolução clínica).
- Nenhuma tabela de `prontuarios`, `evolucoes`, `anexos_clinicos`,
  `prescricoes` ou `exames` existe no schema atual
  (`supabase/portable/02_schema_public.sql`).

**Não invente esses componentes/arquivos em documentação, exemplos ou
sugestões de caminho de arquivo** — eles não existem no código-fonte deste
projeto até o momento desta skill ser escrita.

## Quando implementar de verdade

Se o time decidir construir um módulo de prontuário, siga os padrões já
estabelecidos no restante do projeto (ver [[database]], [[permissions]],
[[patients]]):

### Boas práticas para uma futura implementação

- Nova tabela `public.prontuario_entradas` (ou nome equivalente em
  português, seguindo a convenção `snake_case` do projeto), com
  `paciente_id`, `profissional_id`, `agendamento_id` (nullable — nem toda
  entrada precisa estar ligada a uma consulta específica), `conteudo text`,
  `created_at`, `updated_at`, e RLS desde o primeiro commit.
- Política de leitura restrita: ADMIN sempre; o `PROFISSIONAL` autor da
  entrada; e — decisão de produto explícita necessária — se o
  `RECEPCIONISTA` deve ou não ver conteúdo clínico (por padrão, **não**
  deveria, diferente do que acontece hoje com `pacientes.observacoes`, que é
  visível à recepção).
- Trate qualquer conteúdo clínico como dado sensível: nunca logue, nunca
  inclua em notificações WhatsApp/e-mail automáticas (diferente dos dados de
  agendamento, que já trafegam por notificações).
- Considere apêndice (append-only) em vez de edição destrutiva de entradas
  clínicas — cada entrada deveria preservar histórico de alteração, mesmo
  que o requisito inicial não peça isso explicitamente (é o tipo de decisão
  cara de reverter depois).

### Más práticas

- Reaproveitar `pacientes.observacoes` como se fosse um prontuário
  multi-entrada — é um único campo, sobrescrito a cada edição, sem
  histórico.
- Expor conteúdo clínico para o papel `CLIENTE` sem uma decisão de produto
  explícita sobre o que o paciente pode ver do próprio histórico.
- Misturar dado clínico com dado financeiro/administrativo na mesma tabela.

## Checklist (para quando esta feature for construída)

- [ ] Existe uma decisão de produto documentada sobre quem pode ler/escrever
      cada tipo de entrada clínica?
- [ ] RLS cobre exatamente essa decisão, tabela por tabela?
- [ ] Conteúdo clínico está fora de qualquer trigger de notificação
      automática (WhatsApp/e-mail)?
- [ ] Há trilha de auditoria equivalente à de `user_audit_log` para edição
      de conteúdo clínico sensível?

## Arquivos normalmente envolvidos

Nenhum hoje. Ao criar, siga a estrutura de [[patients]] e [[database]]:
migração em `supabase/migrations/`, reflexo em
`supabase/portable/02_schema_public.sql`, tipos em
`src/integrations/supabase/types.ts`, tela em `src/routes/app.*.tsx`.

## Observações

Esta skill existe para evitar que uma sessão futura do Claude Code
"alucine" um módulo de prontuário que não existe, ou reaproveite
`observacoes` de forma inadequada para um caso de uso que precisa de
histórico estruturado e controle de acesso mais granular.
