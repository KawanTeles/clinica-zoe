# Skill: debugging

## Objetivo

Dar um playbook eficiente para investigar os tipos de bug mais comuns deste
projeto: sessão/permissão, dado desatualizado na UI, erro de trigger SQL
mal interpretado, e problemas específicos de SSR/runtime do TanStack Start.

## Quando utilizar

- Sempre que for investigar um bug reportado antes de propor uma correção.
- Ao ver um erro genérico do Supabase (`PGRST...`, mensagem de constraint)
  e precisar traduzir para a causa real.
- Ao investigar comportamento diferente entre dev local e produção
  (Cloudflare Workers/Vercel/Netlify).

## Boas práticas

- **Erro vindo de `error.message` do Supabase**: primeiro verifique se é uma
  mensagem de `RAISE EXCEPTION` de um trigger (texto em português, ex.:
  "Conflito de horário...", "Fora da disponibilidade do profissional.") —
  nesse caso o comportamento é o esperado, o bug (se houver) está na
  expectativa do usuário/UI, não no banco. Se for um código
  `PGRST...`/erro de policy, o problema é RLS ou schema.
- **"Usuário não vê o que deveria"**: primeiro suspeite de RLS antes de UI —
  reproduza a query em uma sessão real daquele papel (não como ADMIN) e
  confirme se a policy realmente permite. Ver [[permissions]].
- **"Tela não atualiza depois de uma ação"**: verifique se a `queryKey`
  invalidada em `onSuccess` bate exatamente com a `queryKey` usada na tela
  que deveria atualizar — é a causa mais comum de dado "preso".
- **"Funciona local, quebra em produção"**: suspeite primeiro do runtime
  Cloudflare Workers (sem `child_process`/binários nativos) e de variáveis
  de ambiente ausentes no provedor (ver [[deployment]]) antes de suspeitar
  de lógica de aplicação.
- **Erro de autenticação/sessão**: confirme o `scope` (`staff` vs `client`)
  envolvido antes de qualquer outra coisa — muitos bugs de "sessão sumiu"
  são, na verdade, o código lendo o cliente Supabase errado. Ver
  [[authentication]].
- Use os logs de erro já capturados: `src/lib/error-capture.ts` (captura
  erro bruto para o wrapper SSR) e `src/lib/lovable-error-reporting.ts`
  (reporta erros de boundary ao Lovable) — ao investigar um erro 500 em
  produção, esses dois arquivos explicam por que o stack trace pode não
  estar visível diretamente no response.

## Más práticas

- Adicionar `try/catch` silencioso ("engolir o erro") para fazer um sintoma
  desaparecer sem entender a causa raiz — praticamente todo erro relevante
  deste projeto (trigger SQL, RLS, validação zod) já vem com mensagem
  amigável; esconder isso piora a experiência de debug futuro.
- Assumir que um bug de dado é sempre de frontend — dado neste projeto é
  fortemente processado por triggers/functions SQL; sempre considere a
  cadeia completa (ver [[database]]).
- Depurar problema de produção só olhando o código — confirme primeiro
  variáveis de ambiente e preset do Nitro (ver [[deployment]]).

## Fluxo recomendado

1. Reproduza o sintoma com o papel/escopo exato do usuário afetado (não como
   ADMIN "porque é mais fácil").
2. Identifique a camada: UI (React) → dado (TanStack Query cache) →
   Supabase client (RLS/policy) → banco (trigger/function) → notificação
   (se aplicável).
3. Isole a camada usando as ferramentas certas: React DevTools/console para
   UI; `queryKey`/DevTools do TanStack Query para cache; teste da query
   direto no SQL editor do Supabase (como o papel afetado, via
   `set role`/testando a policy) para RLS; `RAISE NOTICE`/logs do Postgres
   para trigger.
4. Corrija na camada correta — não compense um bug de RLS com lógica extra
   no client, nem um bug de client com uma policy mais permissiva "para
   resolver rápido".

## Checklist

- [ ] Reproduzi com o papel/escopo exato do usuário afetado?
- [ ] Identifiquei em qual camada o comportamento diverge do esperado?
- [ ] A mensagem de erro já é uma pista direta (trigger SQL) que só precisa
      ser lida com atenção?
- [ ] A correção ataca a causa raiz na camada certa, não um sintoma em
      outra camada?

## Regras obrigatórias

- Nunca "resolva" um bug de permissão afrouxando uma policy RLS sem
  entender por que ela estava restritiva — pode ser intencional (ver
  [[permissions]]).
- Nunca silencie um erro de trigger com `.catch(() => {})` — a mensagem é
  geralmente a explicação exata do problema para o usuário.

## Arquivos normalmente envolvidos

- `src/lib/error-capture.ts`, `src/lib/error-page.ts`,
  `src/lib/lovable-error-reporting.ts`
- `src/routes/__root.tsx` (`ErrorComponent`, `NotFoundComponent`)
- `src/server.ts` (wrapper SSR)

## Erros comuns

- Confundir erro de rede (Supabase indisponível) com erro de RLS — ambos
  podem se manifestar como "não retornou dado", mas o primeiro geralmente
  vem com `error.message` de rede/timeout, o segundo retorna array vazio ou
  erro de policy explícito.
- Não notar que uma mutação teve sucesso no banco mas a UI não refletiu por
  falha de invalidação de cache — parece "a ação falhou", mas na verdade só
  a leitura ficou desatualizada.

## Exemplos

Ver `examples.md`.

## Observações

Não há Sentry/observabilidade externa configurada além do reporte ao
Lovable (`lovable-error-reporting.ts`) — para produção fora do ambiente
Lovable, considere isso uma lacuna ao investigar erros que só acontecem para
usuários reais.
