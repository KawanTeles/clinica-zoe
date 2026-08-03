# Exemplos — react

## 1. Rota com meta completa e `noindex`

`src/routes/app.solicitacoes.tsx`:

```tsx
export const Route = createFileRoute("/app/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações — Clínica Zoe" },
      { name: "description", content: "Central de solicitações de agendamento." },
      { property: "og:title", content: "Solicitações — Clínica Zoe" },
      { property: "og:description", content: "Central de solicitações de agendamento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SolicitacoesPage,
});
```

## 2. Rota pública com canonical e OG completo

`src/routes/agendamento.tsx`:

```tsx
export const Route = createFileRoute("/agendamento")({
  head: () => ({
    meta: [
      { title: "Agendar consulta — Clínica Zoe" },
      { name: "description", content: "Agende sua consulta na Clínica em minutos..." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" }, // wizard não deve ser indexado, mesmo sendo público
    ],
    links: [{ rel: "canonical", href: "/agendamento" }],
  }),
  component: AgendamentoPage,
});
```

## 3. Formulário com `useState` + `zod.parse` dentro da mutação

`src/components/agenda/AgendaView.tsx`:

```ts
const agSchema = z.object({
  profissional_id: z.string().uuid("Selecione o profissional"),
  paciente_id: z.string().uuid("Selecione o paciente"),
  data: z.string().min(1),
  hora_inicio: z.string().min(1),
  hora_fim: z.string().min(1),
});

const mut = useMutation({
  mutationFn: async () => {
    const parsed = agSchema.parse({ ...form, valor: form.valor ? Number(form.valor) : undefined });
    const { error } = await supabase.from("agendamentos").insert({ /* ... */ status: "PENDENTE" });
    if (error) throw error;
  },
  onError: (e: any) => {
    if (e instanceof z.ZodError) toast.error(e.issues[0].message);
    else toast.error(e?.message ?? "Falha ao criar");
  },
});
```

## 4. Server function consumida como qualquer outra mutação

`src/routes/app.usuarios.tsx`:

```ts
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser } from "@/lib/admin.functions";

const createUser = useServerFn(adminCreateUser);
const mut = useMutation({
  mutationFn: (vars: CreateUserInput) => createUser({ data: vars }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
});
```

## 5. Gate de sessão com `ready` + redirect

```tsx
const { ready, session, isStaff } = useAuth();
const navigate = useNavigate();

useEffect(() => {
  if (!ready) return;
  if (!session || !isStaff) navigate({ to: "/auth", replace: true });
}, [ready, session, isStaff, navigate]);

if (!ready || !session || !isStaff) return <AuthSplash message="Preparando seu ambiente..." />;
```
