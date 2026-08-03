# Exemplos — performance

## 1. Contagem leve vs. busca completa

```ts
// Bom — só o número:
supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("status", "PENDENTE");

// Evitar quando só o número importa:
supabase.from("agendamentos").select("*").eq("status", "PENDENTE"); // traz tudo à toa
```

## 2. `staleTime` calibrado por frequência real de mudança

`src/lib/clinic-settings.ts` (muda raramente — configurações institucionais):

```ts
useQuery({
  queryKey: CLINIC_SETTINGS_KEY,
  queryFn: fetchClinicSettings,
  staleTime: 5 * 60 * 1000,
});
```

`src/lib/sidebar-badges.ts` (precisa parecer "ao vivo" — contadores
operacionais):

```ts
useQuery({
  queryKey: ["sidebar-badges", session?.user?.id, canFinanceiro],
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
  staleTime: 10_000,
});
```

## 3. Query protegida por `enabled`

```ts
const { data: pacientes } = useQuery({
  queryKey: ["pacientes-lite"],
  queryFn: async () => { /* ... */ },
  enabled: open, // só busca quando o diálogo está de fato aberto
});
```

## 4. Cache de Signed URL alinhado à expiração real

```ts
useQuery({
  queryKey: ["avatar-url", value],
  enabled: !!parsed && !("url" in parsed),
  staleTime: 50 * 60 * 1000, // signed URL expira em 60min — refaz com folga de 10min
  gcTime: 60 * 60 * 1000,
  retry: 1,
  queryFn: async () => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  },
});
```

## 5. Preview limitado com link para a tela completa

`src/routes/app.index.tsx`:

```ts
supabase
  .from("agendamentos")
  .select("id, data, hora_inicio, status, paciente:pacientes(nome)")
  .eq("data", today)
  .order("hora_inicio")
  .limit(6); // só um preview no dashboard — a lista completa fica em /app/agenda
```
