# Skill: testing

## Objetivo

Estabelecer uma proposta de testes compatível com a stack atual (Vite +
TanStack Start + React 19 + Supabase) e, na ausência de suite automatizada
hoje, um roteiro de verificação manual confiável para os fluxos críticos.

## Estado atual do projeto (importante)

Não há framework de teste configurado em `package.json` (sem `vitest`,
`jest`, `@testing-library/*`, `playwright`, `cypress`). A pasta `tests/`
existe no repositório mas está vazia. **Não afirme que existe suite de
testes rodando em CI** — não há CI configurado para isso neste repositório.

## Quando utilizar

- Ao ser pedido para "adicionar testes" — primeiro confirme com o
  time/usuário se o objetivo é (a) configurar a stack de testes do zero, ou
  (b) apenas validar manualmente uma mudança específica.
- Antes de considerar qualquer mudança em fluxo crítico (agendamento,
  aprovação, financeiro, permissões, autenticação) como "concluída".

## Boas práticas (para quando testes automatizados forem introduzidos)

- Stack recomendada, compatível com o Vite já usado pelo projeto:
  **Vitest** (unit/integration, mesmo runtime de módulos do Vite, zero
  config adicional de bundler) + **Testing Library** (`@testing-library/react`)
  para componentes, e **Playwright** para E2E dos fluxos críticos
  (agendamento público → aprovação → financeiro).
- Funções puras já isoladas em `src/lib/*.ts` sem dependência de React/DOM
  (`agenda-utils.ts`, `whatsapp-link.ts`, `password.ts`) são os candidatos
  ideais para os primeiros testes unitários — não dependem de mock de
  Supabase.
- Para testar lógica que depende do Supabase, prefira testar contra um
  projeto Supabase real de desenvolvimento/staging (o schema é totalmente
  portátil via `supabase/portable/`, ver [[supabase]]) a mockar o SDK
  inteiro — a lógica de negócio real vive em triggers SQL, que um mock
  nunca vai exercitar de verdade.
- Regras de negócio no banco (conflito de agenda, congelamento de valor,
  criação de financeiro) são mais bem testadas com testes **SQL/pgTAP** ou
  scripts de integração que rodam contra uma instância real — testar só a
  chamada TypeScript não cobre o trigger.

## Más práticas

- Mockar `supabase.from(...)` de forma tão profunda que o teste para de
  exercitar RLS/triggers — o valor de um teste de integração aqui vem
  justamente de bater no banco real (staging) e confirmar que a política e
  o trigger se comportam como esperado.
- Escrever teste E2E que loga como ADMIN para tudo — os bugs mais prováveis
  deste sistema são de permissão por papel; teste os quatro papéis nos
  fluxos que os tocam.
- Declarar uma mudança "testada" só porque compilou (`tsc`) — compilação
  não valida RLS, triggers, nem fluxo de UI.

## Fluxo recomendado (verificação manual, estado atual sem automação)

1. Teste como o papel mais restrito afetado pela mudança primeiro (ex.:
   `CLIENTE` para uma mudança na Área do Cliente; `PROFISSIONAL` para uma
   mudança na agenda).
2. Para mudanças em `agendamentos`: crie um agendamento de teste, confirme
   o conflito é bloqueado, aprove e confirme que `financeiro` foi criado
   automaticamente, cancele e confirme que o `financeiro` foi marcado
   `CANCELADO`.
3. Para mudanças em permissões: confirme tanto o caso positivo (papel
   correto consegue) quanto o negativo (outro papel não consegue, inclusive
   tentando a operação "por fora" da UI, ex. via `curl`/SQL editor
   simulando o token).
4. Para mudanças de UI: confirme claro e escuro, e o estado vazio/loading.

## Checklist

- [ ] Testado como o papel mais restrito afetado, não só como ADMIN?
- [ ] Se toca agenda/financeiro, o ciclo completo
      (criar → aprovar → financeiro → notificação) foi verificado
      manualmente?
- [ ] Se adicionar testes automatizados, a stack escolhida foi Vitest/
      Testing Library/Playwright (compatível com Vite), não uma stack que
      exige bundler diferente?
- [ ] Testes de regra de negócio crítica exercitam o banco real
      (staging), não só um mock do SDK?

## Regras obrigatórias

- Nenhuma alteração em fluxo crítico é considerada "pronta" sem verificação
  manual nos papéis relevantes, na ausência de suite automatizada.
- Testes futuros não devem rodar contra o projeto Supabase de **produção**
  — usar um projeto de desenvolvimento/staging separado, dado que o schema
  é portátil.

## Arquivos normalmente envolvidos

- `tests/` (hoje vazia — ponto de partida se a stack for configurada)
- `package.json` (`scripts` — precisaria adicionar `test`)

## Erros comuns

- Assumir que testes de UI isolados (sem tocar o Supabase real) cobrem
  regras de negócio — a maior parte da lógica crítica deste projeto está no
  banco, não no componente.
- Testar só o caminho feliz de um fluxo com múltiplos papéis — os bugs mais
  caros aqui são de permissão, não de lógica de UI pura.

## Exemplos

Ver `examples.md`.

## Observações

Se o time decidir priorizar testes automatizados, o maior ganho imediato
custo/benefício é: (1) unit tests para `src/lib/agenda-utils.ts` e
`whatsapp-link.ts` (puros, zero setup), e (2) um teste E2E do fluxo
"paciente agenda → equipe aprova → financeiro é criado" contra um projeto
Supabase de staging.
