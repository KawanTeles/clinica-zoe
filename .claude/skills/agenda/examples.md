# Exemplos — agenda

## 1. Derivando `hora_fim` da duração do profissional

`src/components/agenda/AgendaView.tsx` (`NovoAgendamentoDialog`):

```ts
const setStart = (v: string) => {
  const dur = selectedProf?.duracao_consulta_min ?? 60;
  setForm((f) => ({
    ...f,
    hora_inicio: v,
    hora_fim: addMinutes(v, dur),
    valor: f.valor || String(selectedProf?.valor_consulta_avista ?? ""),
  }));
};
```

## 2. Consultando slots livres via função SQL

`src/routes/agendamento.tsx`:

```ts
const { data: slots } = useQuery({
  queryKey: ["site-agendamento-slots", profissionalId, data],
  queryFn: async () => {
    const { data: rows, error } = await supabase.rpc("horarios_disponiveis", {
      p_profissional_id: profissionalId,
      p_data: data,
    });
    if (error) throw error;
    return rows ?? [];
  },
  enabled: !!profissionalId && !!data,
});
```

## 3. Mutação de status com invalidação em cascata

`src/components/agenda/AgendaView.tsx`:

```ts
const statusMut = useMutation({
  mutationFn: async ({ id, status }: { id: string; status: AgendamentoStatus }) => {
    const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["agenda"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  },
  onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
});
```

## 4. Disponibilidade semanal por profissional

`DisponibilidadeCard` em `AgendaView.tsx` insere em
`profissional_disponibilidade` filtrando por `dia_semana` (0–6):

```ts
const add = useMutation({
  mutationFn: async () => {
    const { error } = await supabase.from("profissional_disponibilidade").insert({
      profissional_id: profissionalId,
      dia_semana: Number(form.dia_semana),
      hora_inicio: form.hora_inicio,
      hora_fim: form.hora_fim,
    });
    if (error) throw error;
  },
});
```

Um novo `profissional` recebe disponibilidade padrão automaticamente (trigger
`seed_disponibilidade_padrao`: seg–sex, 08:00–12:00 e 14:00–18:00) — não
recrie essa lógica no formulário de cadastro de profissional.
