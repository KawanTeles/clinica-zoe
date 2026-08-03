# Exemplos — dashboard

## 1. Agregação única via `Promise.all`

`src/routes/app.index.tsx`:

```ts
const { data: stats } = useQuery({
  queryKey: ["dashboard-stats"],
  queryFn: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [profs, pacs, agHoje, agPend, agConfirmHoje, agCancHoje, finAberto, agHojeLista, pendentesLista] =
      await Promise.all([
        supabase.from("profissionais").select("id", { count: "exact", head: true }),
        supabase.from("pacientes").select("id", { count: "exact", head: true }),
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("data", today),
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("status", "PENDENTE"),
        // ...
      ]);
    return { profissionais: profs.count ?? 0, /* ... */ };
  },
});
```

## 2. `StatCard` reutilizável

```tsx
function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; accent: "primary" | "gold" | "emerald" | "red";
}) {
  const styles = {
    gold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/15 text-red-600 dark:text-red-400",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card className="shadow-soft transition-all duration-200 hover:shadow-elegant">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${styles[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

## 3. Ação rápida com fallback de compatibilidade de schema

```ts
const aprovarMut = useMutation({
  mutationFn: async (item: any) => {
    const { data: conflitos } = await supabase.from("agendamentos").select("id")
      .eq("profissional_id", item.profissional_id).eq("data", item.data).eq("status", "APROVADO")
      .neq("id", item.id).lt("hora_inicio", item.hora_fim).gt("hora_fim", item.hora_inicio);
    if (conflitos && conflitos.length > 0) {
      throw new Error("Conflito: O profissional já tem consulta aprovada neste horário!");
    }
    const { error } = await supabase.from("agendamentos")
      .update({ status: "APROVADO", aprovado_por: user?.id ?? null, aprovado_em: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      if (error.message?.includes("schema cache") || (error as any).code === "PGRST204") {
        const { error: fallbackErr } = await supabase.from("agendamentos")
          .update({ status: "APROVADO" }).eq("id", item.id);
        if (fallbackErr) throw fallbackErr;
      } else throw error;
    }
  },
  onSuccess: (_, item) => {
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["solicitacoes"] });
    qc.invalidateQueries({ queryKey: ["agenda"] });
  },
});
```

## 4. Conteúdo condicionado a papel, calculado uma vez

```ts
const { roles } = useAuth();
const isAdmin = roles.includes("ADMIN");
const isProfissional = roles.includes("PROFISSIONAL");
// ...
{isAdmin ? <ReceitaEmAbertoCard /> : <ResumoDoDiaCard />}
```
