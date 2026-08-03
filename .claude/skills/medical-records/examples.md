# Exemplos — medical-records

## O que existe hoje (único exemplo real)

`src/routes/app.pacientes.tsx` edita o campo único de observações do
paciente:

```ts
const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  telefone: z.string().trim().optional(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  data_nascimento: z.string().optional(),
  observacoes: z.string().optional(),
});
```

Isso grava diretamente em `public.pacientes.observacoes` (um `UPDATE`
simples, sem histórico de versões, sem vínculo com consulta específica).

## Esqueleto de referência para uma tabela futura (não implementado)

Este bloco é um **rascunho de referência**, não código existente no projeto
— use como ponto de partida caso o módulo seja aprovado, seguindo o mesmo
estilo das migrações reais em `supabase/migrations/`:

```sql
-- ESBOÇO — não aplicado no projeto ainda
CREATE TABLE public.prontuario_entradas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prontuario_entradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY prontuario_admin_all ON public.prontuario_entradas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY prontuario_profissional_own ON public.prontuario_entradas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = prontuario_entradas.profissional_id AND p.user_id = auth.uid()
  ));

CREATE TRIGGER trg_prontuario_updated
  BEFORE UPDATE ON public.prontuario_entradas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Antes de aplicar algo assim de verdade, valide a decisão de acesso do
`RECEPCIONISTA` e do `CLIENTE` com o time — este esboço propositalmente
**não** dá acesso a nenhum dos dois papéis.
