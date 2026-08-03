# Exemplos — typescript

## 1. Union type de domínio reexportado de um único lugar

`src/lib/auth-context.tsx`:

```ts
export type AppRole = "ADMIN" | "RECEPCIONISTA" | "PROFISSIONAL" | "CLIENTE";
```

Reusado em `src/lib/admin.functions.ts`:

```ts
import type { AppRole } from "@/lib/auth-context";

const createUserSchema = z.object({
  role: z.enum(["ADMIN", "RECEPCIONISTA", "PROFISSIONAL", "CLIENTE"]),
  // ...
});
```

## 2. Tipo derivado de schema `zod`

```ts
const setActiveSchema = z.object({ user_id: z.string().uuid(), ativo: z.boolean() });

export const adminSetUserActive = createServerFn({ method: "POST" })
  .inputValidator((data: z.infer<typeof setActiveSchema>) => setActiveSchema.parse(data))
  .handler(async ({ data }) => { /* data já está tipado e validado */ });
```

## 3. `any` tolerado em resposta de query com relação (uso pragmático)

`src/components/agenda/AgendaView.tsx`:

```ts
const { data: agendamentos } = useQuery({
  queryFn: async () => {
    const { data: rows, error } = await supabase
      .from("agendamentos")
      .select("id, data, hora_inicio, status, paciente:pacientes(id,nome,telefone,foto_url), profissional:profissionais(id,nome,especialidade:especialidades(nome))");
    if (error) throw error;
    return rows ?? [];
  },
});

// consumido como `any` no map — aceitável para este padrão específico:
{agendamentos?.map((a: any) => (
  <span>{a.paciente?.nome}</span>
))}
```

## 4. Tipo explícito para retorno de server function

`src/lib/users.functions.ts`:

```ts
export type AdminUserRow = {
  id: string;
  nome: string | null;
  email: string | null;
  roles: string[];
  ativo: boolean;
  removido_em: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

export const adminListUsers = createServerFn({ method: "POST" })
  .handler(async ({ context }): Promise<AdminUserRow[]> => { /* ... */ });
```
