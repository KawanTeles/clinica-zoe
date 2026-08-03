# Skill: performance

## Objetivo

Manter os padrões de performance já estabelecidos no projeto — cache de
query bem calibrado, contagens leves, sinalização de sessão eficiente — e
evitar regressões comuns em uma app SSR sobre Cloudflare Workers.

## Quando utilizar

- Ao adicionar uma nova `useQuery`/contagem/listagem.
- Ao notar uma tela lenta ou requests redundantes.
- Ao avaliar se algo deve rodar no server (SSR/server function) ou no
  client.

## Boas práticas

- **Contagens**: `select("id", { count: "exact", head: true })` em vez de
  trazer linhas completas quando só o número importa (ver
  `sidebar-badges.ts`, `app.index.tsx`).
- **`staleTime`/`refetchInterval` intencionais**: dado que muda pouco
  (configurações da clínica) usa `staleTime` alto (5 minutos); dado
  operacional que precisa parecer "ao vivo" (badges da sidebar) usa
  `refetchInterval` curto (30s) — escolha o valor pensando em "com que
  frequência isso realmente muda", não copie um valor genérico.
- **Signed URLs**: cache alinhado à validade real do link assinado
  (`staleTime: 50min` para um link de 60min) — evita gerar uma URL
  assinada nova a cada render/foco de janela.
- **Queries condicionais**: sempre `enabled: <condição>` para não disputar
  banda com requests que ainda não têm parâmetro válido (sessão não
  carregada, diálogo fechado, filtro vazio).
- **`.limit(...)`** em listas de preview (ex.: 5-6 itens no Dashboard) em
  vez de carregar tudo para só mostrar um resumo.
- Imagens (`<img>` de avatar/foto) usam `loading="lazy"`.

## Más práticas

- Fazer polling agressivo (`refetchInterval` curto) em dado que raramente
  muda — gera carga desnecessária no Supabase sem ganho perceptível de UX.
- Buscar `select("*")` quando só 2-3 colunas são usadas na tela — aumenta
  payload e reduz cache-hit da CDN/borda sem necessidade.
- Recalcular Signed URL a cada render por não usar `queryKey` estável
  (`["avatar-url", value]` já é o padrão — manter o `value` como parte da
  key evita URLs obsoletas).
- Rodar lógica pesada (processamento de imagem, cálculo complexo) no
  request handler do Cloudflare Worker sem considerar o limite de CPU-time
  do runtime.

## Fluxo recomendado

1. Antes de escrever uma query nova, pergunte: "eu preciso das linhas ou só
   de um número/existência?" → escolha `head: true` quando aplicável.
2. Escolha `staleTime`/`refetchInterval` com base na frequência real de
   mudança do dado, não em um valor padrão arbitrário.
3. Sempre que uma query depende de algo assíncrono (sessão, seleção do
   usuário, abertura de diálogo), proteja com `enabled`.
4. Para listas potencialmente grandes usadas só como preview, use
   `.limit(...)` e ofereça um link para a tela completa (ver Dashboard →
   "Ver Central de Solicitações").

## Checklist

- [ ] Contagem usa `head: true`, não busca linhas inteiras à toa?
- [ ] `staleTime`/`refetchInterval` correspondem à frequência real de
      mudança do dado?
- [ ] Query condicional tem `enabled` correto?
- [ ] Nenhuma dependência incompatível com Cloudflare Workers foi
      introduzida (ver [[deployment]])?

## Regras obrigatórias

- Nenhum código server-side novo usa `child_process`, `sharp`, `canvas` ou
  qualquer pacote que exija binário nativo — quebra o runtime padrão
  (Cloudflare Workers/`workerd`).
- Signed URLs de Storage nunca são geradas em loop sem cache — sempre via
  `useQuery` com `queryKey` estável.

## Arquivos normalmente envolvidos

- `src/lib/sidebar-badges.ts`, `src/lib/clinic-settings.ts`,
  `src/lib/avatar.tsx` — referências de calibração de cache.
- `vite.config.ts` (build/preset).

## Erros comuns

- Esquecer `enabled` e disparar uma query com `id: undefined` antes da
  sessão/seleção carregar — gera erro silencioso ou request desperdiçado.
- Definir `refetchInterval` em uma tela que já tem `staleTime` alto para o
  mesmo dado — os dois configs competem e o comportamento fica
  imprevisível; escolha um ou outro conforme o caso (polling vs cache
  passivo).

## Exemplos

Ver `examples.md`.

## Observações

Não há budget de performance formalizado (Lighthouse CI, etc.) neste
projeto — a disciplina de performance hoje é convenção de código, reforçada
por esta skill.
