# Skill: dashboard

## Objetivo

Orientar mudanças no Dashboard do Painel (`src/routes/app.index.tsx`):
indicadores em tempo real, ações rápidas e a diferenciação de conteúdo por
papel (ADMIN vê receita, PROFISSIONAL/RECEPCIONISTA veem resumo do dia).

## Quando utilizar

- Ao adicionar/alterar um `StatCard` ou indicador do Dashboard.
- Ao mudar o comportamento de aprovação rápida direto do Dashboard.
- Ao investigar números divergentes entre Dashboard, badges da sidebar e
  telas específicas (Agenda, Financeiro, Solicitações).

## Boas práticas

- Uma única query `["dashboard-stats"]` traz todos os agregados via
  `Promise.all` de várias contagens/consultas — siga esse padrão para
  indicadores novos (adicione mais uma entrada ao `Promise.all` em vez de
  criar uma segunda `useQuery` separada), a menos que o novo dado tenha um
  ciclo de atualização claramente diferente do resto.
- Use `select("id", { count: "exact", head: true })` para qualquer contagem
  nova — é o padrão de todo o arquivo (contagem de profissionais, pacientes,
  agendamentos do dia, pendentes, confirmadas, canceladas).
- Ações rápidas (como aprovar solicitação direto do Dashboard) devem
  invalidar as mesmas `queryKey`s que a tela "oficial" daquela ação invalida
  (`["dashboard-stats"]`, `["solicitacoes"]`, `["agenda"]`) — ver
  `aprovarMut` como referência.
- Diferencie conteúdo por papel checando `roles.includes(...)` uma vez no
  topo do componente (`isAdmin`, `isProfissional`) e reutilize essas
  variáveis, em vez de repetir `hasRole` inline em vários pontos do JSX.

## Más práticas

- Buscar todas as linhas de uma tabela grande só para contar no client —
  sempre prefira `count: "exact", head: true` do Supabase.
- Duplicar a lógica de aprovação (`aprovarMut`) de forma diferente da usada
  em `app.solicitacoes.tsx` — mantenha as regras de conflito e o payload de
  atualização consistentes entre os dois pontos de entrada.
- Mostrar dado financeiro consolidado da clínica para um papel que não é
  ADMIN — o card de "Receita em Aberto" já é condicionado a `isAdmin`; siga
  o mesmo cuidado para qualquer indicador financeiro novo.

## Fluxo recomendado

1. Adicione a nova métrica ao `Promise.all` de `["dashboard-stats"]`.
2. Se for uma contagem simples, use `head: true`; se precisar de detalhes
   (lista), traga só os campos necessários com `.limit(...)` (ver
   `agHojeLista`/`pendentesLista`, limitadas a 6 e 5 itens
   respectivamente).
3. Renderize com `StatCard` (ícone + label + valor + `accent`) para métricas
   numéricas simples, seguindo as cores de `accent` já definidas
   (`primary`, `gold`, `emerald`, `red`).
4. Para ações diretas no Dashboard (como aprovar), reaproveite a mesma
   validação de conflito e o mesmo payload de atualização que a tela
   dedicada usa.

## Checklist

- [ ] Nova métrica está dentro do `Promise.all` único de
      `dashboard-stats`, não uma query solta sem necessidade?
- [ ] Usa `count: "exact", head: true` quando só o número importa?
- [ ] Conteúdo condicionado a papel usa as variáveis já calculadas
      (`isAdmin`, `isProfissional`)?
- [ ] Ação rápida nova invalida as mesmas `queryKey`s que a tela dedicada
      equivalente?

## Regras obrigatórias

- Nenhuma ação destrutiva (cancelar, recusar, remover) deve existir como
  "ação de um clique" no Dashboard sem confirmação — o padrão hoje só expõe
  aprovação rápida (reversível/de baixo risco) diretamente no Dashboard;
  ações mais sensíveis ficam nas telas dedicadas com diálogos de
  confirmação.

## Arquivos normalmente envolvidos

- `src/routes/app.index.tsx`

## Erros comuns

- Esquecer o fallback de conflito na aprovação rápida (`PGRST204`/
  `schema cache` → refaz o update sem os campos opcionais) — é um detalhe
  de compatibilidade já tratado em `aprovarMut`; ao copiar esse padrão para
  uma ação nova, mantenha o mesmo tratamento se a mutação usar colunas que
  podem não existir em todo ambiente (ex.: campos adicionados por migração
  recente).
- Renderizar `StatCard` com `value` não numérico — o componente assume
  `number` e formata direto no JSX.

## Exemplos

Ver `examples.md`.

## Observações

O Dashboard é deliberadamente "read + ações rápidas de baixo risco" — para
qualquer fluxo mais elaborado, direcione o usuário para a tela dedicada
(`Link to="/app/solicitacoes"` etc.) em vez de replicar a tela inteira ali.
