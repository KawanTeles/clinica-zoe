# Exemplos — supabase

## 1. Query comum via client (RLS resolve)

`src/routes/app.pacientes.tsx`:

```ts
const { data, isLoading } = useQuery({
  queryKey: ["pacientes"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("pacientes")
      .select("id, nome, email, telefone, data_nascimento, observacoes, foto_url, created_at")
      .order("nome");
    if (error) throw error;
    return data;
  },
});
```

Nenhuma checagem de papel no código — a policy `pac_read` já limita o que
volta para o usuário logado.

## 2. Server function completa (par functions/server)

`src/lib/admin.functions.ts` (client-safe):

```ts
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, loadUsers } = await import("@/lib/users.server");
    await assertAdmin(context.supabase, context.userId);
    return loadUsers();
  });
```

`src/lib/users.server.ts` (só server, usa `supabaseAdmin`):

```ts
export async function loadUsers(): Promise<AdminUserRow[]> {
  const [{ data: profiles }, { data: userRoles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, nome, email, ...").order("created_at", { ascending: false }),
    supabaseAdmin.from("user_roles").select("user_id, role"),
  ]);
  // junta profiles + roles + last_sign_in_at (via supabaseAdmin.auth.admin.listUsers)
}
```

## 3. Chamando a server function no client

`src/routes/app.usuarios.tsx` usa `useServerFn` do TanStack Start dentro de
um `useMutation`, exatamente como uma mutação normal do Supabase:

```ts
import { useServerFn } from "@tanstack/react-start";
import { adminSetUserActive } from "@/lib/users.functions";

const setActive = useServerFn(adminSetUserActive);
const mut = useMutation({
  mutationFn: (vars: { user_id: string; ativo: boolean }) => setActive({ data: vars }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
});
```

## 4. Signed URL de avatar com cache alinhado à expiração

`src/lib/avatar.tsx`:

```ts
export function useAvatarUrl(value?: string | null) {
  const parsed = splitStoragePath(value);
  const { data } = useQuery({
    queryKey: ["avatar-url", value],
    enabled: !!parsed && !("url" in parsed),
    staleTime: 50 * 60 * 1000, // signed URL dura 60min — recalcula com folga
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const p = parsed as { bucket: string; path: string };
      const { data, error } = await supabase.storage.from(p.bucket).createSignedUrl(p.path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
  return parsed && "url" in parsed ? parsed.url : (data ?? null);
}
```

## 5. RPC de função SQL a partir do client

`src/routes/agendamento.tsx` chama a função `horarios_disponiveis` (SQL,
`SECURITY DEFINER`) via `.rpc()` em vez de calcular slots no client:

```ts
const { data: rows, error } = await supabase.rpc("horarios_disponiveis", {
  p_profissional_id: profissionalId,
  p_data: data,
});
```
