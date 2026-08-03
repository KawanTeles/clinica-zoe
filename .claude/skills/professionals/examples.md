# Exemplos — professionals

## 1. Leitura pública restrita à view segura

`src/routes/agendamento.tsx`:

```ts
const { data: profissionais } = useQuery({
  queryKey: ["site-agendamento-prof", especialidadeId],
  queryFn: async () => {
    let q = (supabase as any)
      .from("profissionais_public")
      .select("id, nome, duracao_consulta_min, valor_consulta_avista, valor_consulta_cartao, especialidade_id, especialidade:especialidades(nome)")
      .order("nome");
    if (especialidadeId) q = q.eq("especialidade_id", especialidadeId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  enabled: !!especialidadeId,
});
```

## 2. Criação atômica de conta + profissional (server function)

`src/lib/admin.functions.ts` (`adminCreateUser`, trecho):

```ts
const { data: created } = await supabaseAdmin.auth.admin.createUser({
  email: data.email, password: data.senha, email_confirm: true,
  user_metadata: { nome: data.nome, telefone: data.telefone ?? null },
});
const newUserId = created.user.id;

await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });

if (data.role === "PROFISSIONAL") {
  await supabaseAdmin.from("profissionais").insert({
    user_id: newUserId, nome: data.nome, email: data.email,
    especialidade_id: p.especialidade_id ?? null,
    valor_consulta_avista: p.valor_consulta_avista,
    valor_consulta_cartao: p.valor_consulta_cartao,
    duracao_consulta_min: p.duracao_consulta_min,
    status: "ATIVO",
  });
}
```

## 3. Fallback de preço replicado corretamente no client

`src/routes/agendamento.tsx`, espelhando a mesma prioridade de
`resolve_valor_consulta`:

```ts
const valor = useMemo(() => {
  if (!profissional) return null;
  const isCard = forma === "CARTAO_DEBITO" || forma === "CARTAO_CREDITO";
  return isCard
    ? Number(profissional.valor_consulta_cartao ?? profissional.valor_consulta_avista ?? 0)
    : Number(profissional.valor_consulta_avista ?? profissional.valor_consulta_cartao ?? 0);
}, [profissional, forma]);
```

## 4. Desativação em cascata (conta + status de profissional)

`src/lib/users.server.ts` (`setUserActive`):

```ts
await supabaseAdmin.auth.admin.updateUserById(targetId, {
  ban_duration: ativo ? "none" : "876000h",
} as any);

await supabaseAdmin
  .from("profissionais")
  .update({ status: ativo ? "ATIVO" : "INATIVO" })
  .eq("user_id", targetId);
```
