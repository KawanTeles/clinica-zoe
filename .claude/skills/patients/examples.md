# Exemplos — patients

## 1. Validação de cadastro com zod

`src/routes/app.pacientes.tsx`:

```ts
const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  telefone: z.string().trim().optional(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  data_nascimento: z.string().optional(),
  observacoes: z.string().optional(),
});
```

## 2. Listagem alfabética com card + avatar

```tsx
{data.map((p: any) => (
  <Card key={p.id} className="border-border shadow-soft transition hover:shadow-elegant">
    <CardHeader className="pb-2">
      <div className="flex items-center gap-3">
        <PersonAvatar size="md" nome={p.nome} fotoUrl={p.foto_url} />
        <CardTitle className="truncate text-base">{p.nome}</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="space-y-1 text-sm text-muted-foreground">
      {p.email && <p className="truncate">{p.email}</p>}
      {p.telefone && <p>Tel.: {p.telefone}</p>}
    </CardContent>
  </Card>
))}
```

## 3. Paciente visto pelo profissional apenas por vínculo de agendamento

Policy real (`supabase/portable/02_schema_public.sql`), refletida na query da
tela `app.meus-pacientes.tsx` — a visão do profissional nunca faz
`supabase.from("pacientes").select("*")` sem passar pela relação com
`agendamentos`:

```sql
public.has_role(auth.uid(), 'PROFISSIONAL'::public.app_role) AND EXISTS (
  SELECT 1 FROM public.agendamentos a
  JOIN public.profissionais p ON p.id = a.profissional_id
  WHERE a.paciente_id = pacientes.id AND p.user_id = auth.uid()
)
```

## 4. Paciente selecionável dentro de um diálogo, carregado sob demanda

`src/components/agenda/AgendaView.tsx` (`NovoAgendamentoDialog`):

```ts
const { data: pacientes } = useQuery({
  queryKey: ["pacientes-lite"],
  queryFn: async () => {
    const { data, error } = await supabase.from("pacientes").select("id, nome").order("nome");
    if (error) throw error;
    return data ?? [];
  },
  enabled: open, // só busca quando o diálogo está aberto
});
```
