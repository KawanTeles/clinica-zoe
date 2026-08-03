# Exemplos — documentation

## 1. Checklist de implantação em português, formato consistente

`DEPLOYMENT.md`:

```md
## 3. Banco de dados

- [ ] `01_extensions.sql` aplicado (pgcrypto, pg_cron, pg_net)
- [ ] `02_schema_public.sql` aplicado (20 tabelas, funções, triggers, RLS)
- [ ] Funções validadas: `has_role`, `horarios_disponiveis`,
      `resolve_valor_consulta`, `enqueue_notificacao`, `gerar_lembretes`,
      `notif_config`, `normalizar_whatsapp`
```

Ao adicionar uma função SQL crítica nova (ex.: uma nova função
`SECURITY DEFINER` usada por várias telas), adicione o nome dela a essa
lista de "Funções validadas".

## 2. Comentário explicando o "porquê", não o "o quê"

`src/server.ts`:

```ts
// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
```

Não descreve o que a função faz linha a linha (o código já mostra) —
explica a razão não óbvia de a função existir.

## 3. Referência cruzada entre skills

`.claude/skills/agenda/SKILL.md`:

```md
## Observações

`app.solicitacoes.tsx` é a fila de triagem (`status = PENDENTE`) e é
funcionalmente parte do mesmo domínio de agenda, mas tratada também como
parte do fluxo de CRM/atendimento — ver [[crm]] para a perspectiva de
funil/atendimento ao paciente sobre os mesmos dados.
```

## 4. Sendo explícito sobre "schema existe, feature não está ativa"

`.claude/skills/whatsapp/SKILL.md`:

```md
### O que existe só como schema (não implementado)

As tabelas abaixo existem em `supabase/portable/02_schema_public.sql` mas
**não têm rota server-side ou worker consumindo-as** no código atual:
...
```

Esse padrão de honestidade sobre o estado real do código deve ser copiado
em qualquer documentação nova sobre uma feature parcialmente construída.
