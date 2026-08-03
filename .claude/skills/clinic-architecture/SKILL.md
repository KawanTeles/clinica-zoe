# Skill: clinic-architecture

## Objetivo

Dar a visão de sistema necessária para tomar decisões arquiteturais corretas
no projeto Clínica Zoe: como as três áreas (site público, Área do Cliente,
Painel) se relacionam, como dados fluem entre React, TanStack Start e
Supabase, e onde cada tipo de lógica deve morar.

## Quando utilizar

- Antes de decidir **onde** um novo recurso deve viver (rota nova? componente
  compartilhado? server function? trigger SQL?).
- Ao investigar um bug que atravessa camadas (ex.: "o badge da sidebar não
  atualiza depois de aprovar uma solicitação").
- Ao avaliar o impacto de uma mudança que toca autenticação, permissões ou
  schema — praticamente tudo neste projeto conecta a esses três eixos.
- Ao dar onboarding em qualquer outra skill deste diretório — todas assumem
  este modelo mental como base.

## Boas práticas

- Trate o Postgres/Supabase como a **fonte de verdade de regras de negócio**
  (conflito de agenda, valor congelado, criação de financeiro, notificações).
  O React é a camada de apresentação e conveniência, não onde a regra "mora".
- Ao adicionar uma feature, pergunte primeiro: "isso é dado (tabela + RLS),
  é orquestração server-side sensível (`*.functions.ts`/`*.server.ts`), ou é
  puramente apresentação (componente + `useQuery`)?" — isso decide onde
  colocar o código.
- Reaproveite componentes de feature parametrizados por contexto
  (`AgendaView` com `scopedProfissionalId`) em vez de duplicar telas para
  ADMIN vs PROFISSIONAL.
- Ao seguir um fluxo de dado, sempre confirme o **escopo de autenticação**
  (`staff` vs `client`) da rota envolvida — muitos bugs de "não encontrei
  meus dados" são causados por misturar os dois clientes Supabase.

## Más práticas

- Criar uma quarta "área" ou um novo padrão de roteamento fora de
  `src/routes/*.tsx` (ex.: `src/pages/`, layouts aninhados fora da convenção
  do TanStack Start).
- Reimplementar em TypeScript uma validação que já existe como trigger SQL
  "só para ser mais rápido" — isso cria duas fontes de verdade que podem
  divergir.
- Acoplar componentes de UI diretamente a `supabaseAdmin` ou a lógica
  `*.server.ts` — quebra o isolamento client/server e é um risco de
  segurança grave.
- Assumir que a integração WhatsApp Cloud API (tabelas `whatsapp_meta_config`,
  `whatsapp_templates` etc.) está ativa — hoje ela é apenas schema
  preparatório; o fluxo real em produção é `wa.me` (ver [[whatsapp]]).

## Fluxo recomendado

1. Identifique a área (site público / Área do Cliente / Painel) e o escopo
   de auth correspondente (`client`/`staff`) — ver [[authentication]].
2. Identifique quem pode acessar o recurso (quais `app_role`) — ver
   [[permissions]] antes de desenhar a UI.
3. Modele o dado no Postgres primeiro (tabela + RLS + triggers necessários)
   — ver [[database]].
4. Construa a camada de acesso: query direta via `supabase` client (caso
   comum, RLS já protege) ou server function dedicada (caso precise de
   `service_role`, validação complexa ou orquestração multi-tabela) — ver
   [[supabase]].
5. Construa a UI reaproveitando componentes/hook existentes de
   `src/lib` e `src/components`.
6. Depois de qualquer mudança de estado relevante, confirme que as
   `queryKey`s certas são invalidadas (dashboard, badges da sidebar, listas)
   — o sistema depende de TanStack Query para se manter consistente, não há
   realtime/subscriptions.

## Checklist

- [ ] A mudança respeita a fronteira das três áreas (não vaza dado de
      `staff` para `client` nem vice-versa)?
- [ ] A regra de negócio crítica está no banco, não só no frontend?
- [ ] O componente/rota novo segue a estrutura de pastas descrita no
      `CLAUDE.md` §4?
- [ ] Você confirmou no schema (`supabase/portable/02_schema_public.sql`)
      que a tabela/coluna que está usando realmente existe com esse nome?

## Regras obrigatórias

- Um único banco Postgres serve as três áreas — a separação é por RLS e
  papel, nunca por "banco diferente" ou "schema diferente".
- `src/routeTree.gen.ts` é gerado — nunca editar à mão.
- Novo código server-side sensível segue exatamente o padrão
  `*.functions.ts` (client-safe) + `*.server.ts` (admin) descrito em
  [[supabase]] e no `CLAUDE.md` §3.2.

## Arquivos normalmente envolvidos

- `src/routes/__root.tsx` — shell global, providers.
- `src/routes/app.tsx` — layout e guarda de sessão do Painel.
- `src/lib/auth-context.tsx` — fonte única de sessão/papéis no client.
- `src/integrations/supabase/dual-client.ts` — os dois clientes Supabase.
- `supabase/portable/02_schema_public.sql` — schema completo atual.

## Erros comuns

- Usar o `supabase` client errado (staff vs client) dentro de um componente
  compartilhado entre áreas — sempre confirme via `useAuth().scope` ou o
  hook/componente correto.
- Esquecer que `app.tsx` já faz o guard de sessão (`redirect` para `/auth`
  se `!isStaff`) — não duplique essa checagem em cada subrota do painel.
- Tratar `configuracoes_clinica` como estático — ela é editável em
  `/app/configuracoes` e consumida ao vivo pelo site público via
  `useClinicSettings()`.

## Exemplos

Ver `examples.md` para trechos reais do projeto.

## Observações

Este projeto está conectado ao Lovable (editor visual). Mudanças estruturais
grandes (renomear pastas, mudar convenção de rotas) têm impacto tanto no
código quanto na sincronização com o Lovable — combine com o time antes de
fazer refactors amplos de estrutura.
