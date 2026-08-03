# Exemplos — authentication

## 1. Consumindo sessão corretamente em uma rota protegida

`src/routes/app.tsx`:

```tsx
function AppLayout() {
  const { ready, session, nome, roles, isStaff, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!session || !isStaff) navigate({ to: "/auth", replace: true });
  }, [ready, session, isStaff, navigate]);

  if (!ready || !session || !isStaff) {
    return <AuthSplash message="Preparando seu ambiente..." />;
  }
  // ... resto do layout
}
```

Note o padrão: `useEffect` para o *side effect* de navegação, e um `return`
condicional separado para não renderizar o conteúdo protegido nem por um
frame — ambos checam `ready`, não `loading`.

## 2. Login com checagem de conta desativada

`src/lib/auth-login.ts`:

```ts
export async function signInGuarded(scope: AuthScope, email: string, password: string) {
  const supabase = getSupabaseFor(scope);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) { /* mensagens amigáveis por tipo de erro */ }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ativo, removido_em")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile && (profile.ativo === false || profile.removido_em)) {
    await supabase.auth.signOut();
    return { ok: false, message: DISABLED_ERROR };
  }
  return { ok: true };
}
```

Reuse esta função para qualquer novo formulário de login — não implemente
`signInWithPassword` cru em uma tela nova.

## 3. Middleware de autenticação em server function

`src/integrations/supabase/auth-middleware.ts` + uso em
`src/lib/admin.functions.ts`:

```ts
export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => setActiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, setUserActive } = await import("@/lib/users.server");
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode desativar a sua própria conta.");
    }
    return setUserActive(context.userId, data.user_id, data.ativo);
  });
```

`context.userId` vem do JWT validado pelo middleware — nunca do corpo da
requisição.

## 4. Detectando sessão de equipe a partir do site público

`src/lib/staff-session.ts` usa o cliente `staff` mesmo estando fora de
`/app`, para oferecer um atalho de "voltar ao Painel" a um recepcionista que
está navegando pelo site público:

```ts
const staff = getSupabaseFor("staff");
const { data: sessionData } = await staff.auth.getSession();
```

Isso funciona porque os dois clientes coexistem independentemente do
`scopeForPath` da rota atual — `getSupabaseFor("staff")` sempre acessa a
sessão de `zoe-auth-staff`, não importa em que página o hook é chamado.
