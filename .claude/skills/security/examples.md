# Exemplos — security

## 1. Chave de serviço isolada em `*.server.ts`, importada dinamicamente

`src/lib/admin.functions.ts` (client-safe — nenhuma chave sensível aqui):

```ts
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); // import dinâmico
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    // ...
  });
```

## 2. Autenticação via token, nunca via payload

`src/integrations/supabase/auth-middleware.ts`:

```ts
const authHeader = request.headers.get("authorization");
if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");
const token = authHeader.replace("Bearer ", "");

const { data, error } = await supabase.auth.getClaims(token);
if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
```

`context.userId` (do token validado) é o que toda lógica de autorização
usa depois — nunca um `user_id` vindo de `data` no corpo da requisição.

## 3. Dupla proteção: token + papel, antes de qualquer efeito colateral

```ts
export const adminRemoveUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])           // 1. quem é você (token)
  .inputValidator((data) => idSchema.parse(data)) // 2. o payload é válido?
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId); // 3. você pode fazer isso?
    if (data.user_id === context.userId) {
      throw new Error("Você não pode remover a sua própria conta.");
    }
    return removeUser(context.userId, data.user_id); // só então, o efeito
  });
```

## 4. Auditoria obrigatória em ação sensível

`src/lib/users.server.ts`:

```ts
async function registrarAuditoria(params: { actorId: string; targetId: string; acao: string; detalhes?: string | null }) {
  const [actorNome, targetNome] = await Promise.all([nomeDe(params.actorId), nomeDe(params.targetId)]);
  await supabaseAdmin.from("user_audit_log").insert({
    actor_id: params.actorId, actor_nome: actorNome,
    target_user_id: params.targetId, target_nome: targetNome,
    acao: params.acao, detalhes: params.detalhes ?? null,
  });
}
```

## 5. `search_path` protegido em função `SECURITY DEFINER`

```sql
CREATE FUNCTION public.current_user_has_role(_role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'   -- obrigatório: mitiga sequestro de search_path
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role);
$$;
```
