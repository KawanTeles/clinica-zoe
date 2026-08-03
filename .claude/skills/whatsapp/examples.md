# Exemplos — whatsapp

## 1. Sanitização e geração de link

`src/lib/whatsapp-link.ts`:

```ts
export function sanitizePhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function getWhatsAppUrl(phone?: string | null, message?: string): string {
  const cleanPhone = sanitizePhone(phone);
  const encodedMsg = message ? encodeURIComponent(message) : "";
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
}
```

## 2. Disparo a partir de um clique (obrigatório para não ser bloqueado)

`src/routes/app.index.tsx`:

```tsx
<Button
  variant="ghost" size="sm"
  onClick={() => openWhatsAppLink(getWhatsAppUrl(item.paciente.telefone))}
>
  <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
</Button>
```

## 3. Mensagem formatada com o estilo padrão do projeto

```ts
export function formatPatientConfirmationMsg(info: SolicitacaoWhatsAppInfo): string {
  return `Olá, ${info.pacienteNome}!

Sua consulta foi confirmada.

*Data:* ${formatDateBR(info.data)}
*Horário:* ${info.horario}
*Profissional:* ${info.profissionalNome}

Em caso de dúvidas estamos à disposição.

Clínica Zoe`;
}
```

## 4. Schema preparatório para a integração real (não consumido hoje)

Trecho de `supabase/portable/02_schema_public.sql` — existe no banco, mas
sem rota server-side associada no código atual:

```sql
CREATE TABLE public.whatsapp_meta_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    access_token text,
    phone_number_id text,
    business_account_id text,
    app_id text,
    app_secret text,
    verify_token text,
    graph_version text DEFAULT 'v23.0'::text NOT NULL,
    ...
);

CREATE POLICY "Admins gerenciam config meta" ON public.whatsapp_meta_config
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));
```

Se essa integração for construída, o consumo de `access_token` deve
acontecer exclusivamente em um `*.server.ts` chamado por uma
`createServerFn` com `requireSupabaseAuth` + checagem de ADMIN — nunca lido
diretamente pelo client mesmo com a policy acima permitindo `SELECT` a
admins autenticados (a policy protege a *linha*, não impede que o token
vaze para o bundle se for buscado ingenuamente do client).
