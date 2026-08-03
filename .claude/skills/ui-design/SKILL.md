# Skill: ui-design

## Objetivo

Manter a identidade visual "Apple clínica premium" do projeto — paleta
verde-petróleo em `oklch`, elevação suave, densidade confortável — em
qualquer tela ou componente novo, no claro e no escuro.

## Quando utilizar

- Ao criar qualquer componente ou tela nova.
- Ao adicionar uma cor, sombra, raio de borda ou espaçamento que não parece
  ter um token existente.
- Ao revisar se uma tela ficou "fora do padrão" do resto do sistema.

## Boas práticas

- **Cores**: use sempre tokens semânticos do Tailwind definidos em
  `src/styles.css` (`bg-primary`, `text-muted-foreground`,
  `border-destructive`, `bg-secondary`, `text-accent-foreground`, `bg-gold`,
  `bg-cta`) — nunca `bg-[#2F8F83]` ou `bg-green-600` hardcoded. Todos os
  tokens são definidos em `oklch` e têm variante `.dark` correspondente.
- **Elevação**: use as sombras nomeadas (`shadow-soft` para cards em
  repouso, `shadow-elegant` no hover/destaque, `shadow-glow` para realce
  pontual) em vez de `shadow-md`/`shadow-lg` genéricos do Tailwind — mantém
  a identidade visual consistente com a curva de sombra da marca (baseada
  em `oklch(0.35 0.05 180 / ...)`, verde-petróleo suave, não cinza puro).
- **Raio de borda**: use os tokens de raio derivados (`rounded-xl`,
  `rounded-2xl`) que já mapeiam para `--radius-*` — o token base
  `--radius: 0.875rem` já foi calibrado para o estilo "premium arredondado"
  do projeto.
- **Status semânticos** (badges de agendamento/financeiro): siga o padrão
  de `STATUS_COLOR` (`agenda-utils.ts`) — combinação de `bg-{cor}-500/15
  text-{cor}-700 border-{cor}-500/30 dark:text-{cor}-300` — é a única
  exceção documentada ao "sempre usar token semântico", porque representa
  estados de negócio fixos que precisam de uma paleta própria e reconhecível
  (âmbar=pendente, verde=aprovado/finalizado, vermelho=recusado, azul=remarcado).
- **Animações**: use as classes utilitárias já existentes
  (`active-press` para feedback de toque, `animate-fade-in`,
  `animate-scale-in`) e respeite `prefers-reduced-motion` (já tratado
  globalmente para a transição de tema).
- **Densidade**: siga o espaçamento já usado em telas do Painel
  (`space-y-6` entre seções, `gap-4`/`gap-3` em grids de card, `p-4
  sm:p-6 lg:p-8` no container principal do `<main>`).

## Más práticas

- Adicionar um token de cor novo no `@theme inline` sem verificar se um
  token semântico existente já cobre o caso de uso.
- Usar `dark:` inline em componentes de feature para casos que já deveriam
  ser resolvidos por um token semântico (o objetivo dos tokens é justamente
  não precisar de `dark:` espalhado pelo código de feature — só os badges
  de status fixos precisam disso).
- Misturar `shadow-md`/`shadow-lg` do Tailwind puro com `shadow-soft`/
  `shadow-elegant` do projeto na mesma tela — quebra consistência visual.
- Criar um componente novo do zero quando um componente shadcn/ui em
  `src/components/ui/` já resolve (Dialog, AlertDialog, Select, Tabs, etc.).

## Fluxo recomendado

1. Antes de escrever uma classe de cor, procure em `src/styles.css` um
   token semântico que já expresse a intenção (fundo? texto? borda?
   destrutivo? destaque dourado/CTA?).
2. Para variantes de componente (novo estilo de botão, badge, etc.), estenda
   o `cva` do componente existente em vez de estilizar inline com classes
   soltas repetidas.
3. Teste visualmente em claro e escuro (toggle já existe:
   `src/components/theme-toggle.tsx`).
4. Para estados vazios/carregando, siga o padrão já estabelecido (ícone em
   círculo `bg-primary/10 text-primary`, título curto, descrição em
   `text-muted-foreground`) — ver `app.pacientes.tsx`.

## Checklist

- [ ] Toda cor usada é um token do tema (`styles.css`), exceto badges de
      status fixos?
- [ ] Testado em claro e escuro?
- [ ] Sombra usa `shadow-soft`/`shadow-elegant`/`shadow-glow`, não
      `shadow-md`/`shadow-lg` cru?
- [ ] Componente novo reaproveita um primitive de `components/ui/` em vez
      de recriar (Dialog, Select, Dropdown etc.)?
- [ ] Ícones `lucide-react` com `h-4 w-4` (inline) e `shrink-0` dentro de
      flex?

## Regras obrigatórias

- Nenhuma cor hex/rgb hardcoded em componentes `.tsx` — só em
  `src/styles.css`, sempre em `oklch`.
- Todo componente interativo mantém `focus-visible:ring-2` (acessibilidade,
  ver [[performance]]/CLAUDE.md §13).

## Arquivos normalmente envolvidos

- `src/styles.css` — única fonte de tokens de design.
- `src/components/ui/*` — primitives shadcn/ui.
- `components.json` — configuração do shadcn/ui CLI.

## Erros comuns

- Esquecer que `muted-foreground` foi calibrado para contraste AA
  (comentário explícito no CSS) — escurecer/clarear esse token sem checar
  contraste de novo quebra acessibilidade silenciosamente.
- Usar `bg-white`/`bg-black` diretamente em vez de `bg-background`/
  `bg-foreground` — quebra no modo escuro.

## Exemplos

Ver `examples.md`.

## Observações

O projeto tem um badge injetado pelo Lovable escondido via CSS
(`[data-lovable-badge]` etc. em `styles.css`) — não remova essas regras, e
não recrie esconderijos equivalentes em outros lugares.
