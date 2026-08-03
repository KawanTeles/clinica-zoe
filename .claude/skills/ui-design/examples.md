# Exemplos — ui-design

## 1. Tokens semânticos definidos em oklch

`src/styles.css`:

```css
:root {
  --primary: oklch(0.58 0.08 185);        /* #2F8F83 verde-petróleo */
  --primary-foreground: oklch(1 0 0);
  --destructive: oklch(0.58 0.22 25);
  --gold: oklch(0.78 0.11 85);            /* #D6B36A */
  --muted-foreground: oklch(0.452 0.022 250); /* contraste AA */
}
.dark {
  --primary: oklch(0.68 0.09 182);
  --destructive: oklch(0.65 0.20 25);
}
```

Uso em componente: `className="bg-primary text-primary-foreground"` —
funciona automaticamente nos dois temas, sem `dark:` explícito.

## 2. Variantes com `cva` (padrão para qualquer componente com variantes)

`src/components/ui/button.tsx`:

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-soft hover:bg-primary/95 hover:shadow-elegant",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-border/80 bg-background shadow-xs hover:bg-secondary/60",
      },
      size: { default: "h-10 px-4 py-2", sm: "h-8.5 rounded-lg px-3 text-xs", lg: "h-11 rounded-xl px-8 text-base" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

## 3. Badge de status fixo (exceção documentada ao uso de token semântico)

`src/lib/agenda-utils.ts`:

```ts
export const STATUS_COLOR: Record<string, string> = {
  PENDENTE: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  APROVADO: "bg-primary/15 text-primary border-primary/30",
  RECUSADO: "bg-destructive/15 text-destructive border-destructive/30",
  FINALIZADO: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
};
```

## 4. Estado vazio padrão

`src/routes/app.pacientes.tsx`:

```tsx
<Card className="border-dashed">
  <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
      <Users className="h-5 w-5" />
    </div>
    <p className="text-base font-medium">Nenhum paciente cadastrado</p>
  </CardContent>
</Card>
```

## 5. Utilitário custom de "press" tátil

`src/styles.css`:

```css
@utility active-press {
  transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 120ms ease;
  &:active { transform: scale(0.98); }
}
```
