# Skill: typescript

## Objetivo

Manter o código consistente com a configuração `strict` do projeto e com o
uso pragmático (não purista) de tipos que já existe — sabendo onde `any` é
tolerado hoje e onde não deveria se espalhar mais.

## Quando utilizar

- Ao escrever qualquer novo arquivo `.ts`/`.tsx`.
- Ao tipar uma resposta de query do Supabase com relações (`select` com
  joins).
- Ao decidir se vale a pena introduzir um tipo/interface novo ou reaproveitar
  `Database` de `integrations/supabase/types.ts`.

## Boas práticas

- `tsconfig.json` tem `strict: true` mas `noUnusedLocals`/
  `noUnusedParameters` desligados — isso é intencional (não é um convite
  para deixar código morto, é para não travar em imports temporários durante
  desenvolvimento). Não reative essas flags sem alinhar com o time; isso
  mudaria o comportamento de lint em todo o projeto.
- Use o path alias `@/*` (mapeado para `./src/*`) em vez de imports
  relativos longos (`../../../lib/x`) — é o padrão em 100% do código
  existente.
- Para o resultado de uma query Supabase com relação
  (`select("id, paciente:pacientes(nome)")`), o SDK não infere o tipo
  aninhado automaticamente de forma legível — o projeto tolera `any` nesses
  pontos específicos (ver `AgendaView.tsx`, `app.index.tsx`). Se for
  reescrever uma dessas queries, prefira tipar com um `type` local explícito
  descrevendo o formato esperado em vez de introduzir mais `any`, mas não é
  bloqueante manter o padrão existente.
- Reexporte tipos de domínio a partir do módulo que os define (ex.:
  `AppRole` vem de `@/lib/auth-context`, `AdminUserRow` de
  `@/lib/users.functions`) — não redefina o mesmo shape em dois lugares.
- Para schemas de validação, deixe o `zod` ser a fonte do tipo quando
  possível (`z.infer<typeof schema>`) em vez de manter uma `interface`
  manual paralela que pode divergir do schema.

## Más práticas

- Introduzir `any` novo em código que **não** é uma resposta de query
  Supabase com relação complexa — para lógica de negócio pura, tipos
  explícitos são esperados.
- Reativar `noUnusedLocals`/`noUnusedParameters` isoladamente em um arquivo
  via comentário de lint sem necessidade — é uma configuração de projeto,
  não por arquivo.
- Duplicar o enum de papéis/status em TypeScript com valores diferentes dos
  enums do Postgres — sempre espelhe exatamente os valores de
  `app_role`, `agendamento_status`, `financeiro_status`, `forma_pagamento`,
  etc.

## Fluxo recomendado

1. Ao tipar um dado vindo do Supabase, primeiro veja se `Database` (gerado
   em `integrations/supabase/types.ts`) já cobre a tabela.
2. Para relações/joins, defina um `type` local minimalista com só os campos
   selecionados (evita tipos gigantes desnecessários).
3. Para payload de formulário, derive de um schema `zod`
   (`z.infer<typeof schema>`).
4. Para enums espelhando o banco, garanta que os valores literais batem
   exatamente com o enum SQL (mesma grafia, mesmo case).

## Checklist

- [ ] Usou o path alias `@/*` em vez de import relativo profundo?
- [ ] `any` novo, se existir, está restrito a um caso de query
      Supabase com relação — não em lógica de negócio pura?
- [ ] Enum/union type espelha exatamente os valores do enum Postgres
      correspondente?
- [ ] Tipo de formulário deriva do schema `zod`, não duplicado manualmente?

## Regras obrigatórias

- `strict: true` deve continuar passando — não adicione `// @ts-ignore`/
  `// @ts-expect-error` para contornar um erro de tipo real; corrija o
  tipo.
- Path alias `@/*` obrigatório para imports de `src/` fora do próprio
  diretório do arquivo.

## Arquivos normalmente envolvidos

- `tsconfig.json`
- `src/integrations/supabase/types.ts` (tipos `Database`, gerado)
- Qualquer `.ts`/`.tsx` do projeto

## Erros comuns

- Esquecer que `types.ts` e os arquivos de cliente Supabase têm o cabeçalho
  "automatically generated. Do not edit it directly." — mudanças de schema
  precisam ser refletidas ali via regeneração, não edição manual pontual.
- Tipar `AppRole` como `string` solto em vez de reusar o union type
  `"ADMIN" | "RECEPCIONISTA" | "PROFISSIONAL" | "CLIENTE"` já exportado de
  `auth-context.tsx`.

## Exemplos

Ver `examples.md`.

## Observações

Não há um linter de tipo estrito adicional (ex.: `typescript-eslint` com
regras extras de `no-explicit-any`) configurado além do `tsc --noEmit`
padrão do build — a disciplina sobre `any` hoje é convenção de time, não
imposta por ferramenta.
