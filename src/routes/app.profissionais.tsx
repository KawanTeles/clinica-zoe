import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { adminCreateUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Stethoscope } from "lucide-react";
import { AvatarUploader } from "@/components/media/AvatarUploader";
import { PersonAvatar } from "@/lib/avatar";

export const Route = createFileRoute("/app/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Clínica Zoe" },
      { name: "description", content: "Gerencie os profissionais da clínica." },
      { property: "og:title", content: "Profissionais — Clínica Zoe" },
      { property: "og:description", content: "Gerencie os profissionais da clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfissionaisPage,
});

function ProfissionaisPage() {
  const { hasRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !hasRole("ADMIN")) navigate({ to: "/app" });
  }, [loading, hasRole, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, user_id, foto_url, nome, email, telefone, status, valor_consulta_avista, valor_consulta_cartao, duracao_consulta_min, especialidade:especialidades(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profissionais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre e gerencie os profissionais que atendem na clínica.
          </p>
        </div>
        <NovoProfissionalDialog />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <p className="text-base font-medium">Nenhum profissional cadastrado</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Cadastre o primeiro profissional para começar a organizar a agenda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p: any) => (
            <Card key={p.id} className="border-border shadow-soft transition hover:shadow-elegant">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <PersonAvatar size="md" nome={p.nome} fotoUrl={p.foto_url} />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{p.nome}</CardTitle>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {p.especialidade?.nome ?? "Sem especialidade"}
                    </p>
                  </div>
                  <Badge variant={p.status === "ATIVO" ? "default" : "secondary"}>{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="truncate text-muted-foreground">{p.email}</p>
                {p.telefone && <p className="text-muted-foreground">{p.telefone}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
                  <span>À vista: R$ {Number(p.valor_consulta_avista ?? 0).toFixed(2)}</span>
                  <span>Cartão: R$ {Number(p.valor_consulta_cartao ?? 0).toFixed(2)}</span>
                  <span>{p.duracao_consulta_min} min</span>
                </div>
                <FotoProfissionalDialog id={p.id} nome={p.nome} fotoUrl={p.foto_url} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const formSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  telefone: z.string().trim().optional(),
  especialidade_id: z.string().uuid().optional().nullable(),
  registro_profissional: z.string().optional(),
  descricao: z.string().optional(),
  formacao: z.string().optional(),
  anos_experiencia: z.number().int().min(0).max(80),
  valor_consulta_avista: z.number().nonnegative(),
  valor_consulta_cartao: z.number().nonnegative(),
  duracao_consulta_min: z.number().int().positive(),
});

function NovoProfissionalDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateUser);

  const { data: especialidades } = useQuery({
    queryKey: ["especialidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("especialidades").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    especialidade_id: "",
    registro_profissional: "",
    descricao: "",
    formacao: "",
    anos_experiencia: 0,
    valor_consulta_avista: 0,
    valor_consulta_cartao: 0,
    duracao_consulta_min: 60,
  });
  const [foto, setFoto] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.parse({
        ...form,
        especialidade_id: form.especialidade_id || null,
      });
      return createFn({
        data: {
          nome: parsed.nome,
          email: parsed.email,
          senha: parsed.senha,
          telefone: parsed.telefone || null,
          role: "PROFISSIONAL",
          profissional: {
            especialidade_id: parsed.especialidade_id ?? null,
            registro_profissional: parsed.registro_profissional || null,
            descricao: parsed.descricao || null,
            formacao: parsed.formacao || null,
            anos_experiencia: parsed.anos_experiencia || null,
            valor_consulta_avista: parsed.valor_consulta_avista,
            valor_consulta_cartao: parsed.valor_consulta_cartao,
            duracao_consulta_min: parsed.duracao_consulta_min,
            foto_url: foto,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Profissional cadastrado");
      qc.invalidateQueries({ queryKey: ["profissionais"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm({
        nome: "",
        email: "",
        senha: "",
        telefone: "",
        especialidade_id: "",
        registro_profissional: "",
        descricao: "",
        formacao: "",
        anos_experiencia: 0,
        valor_consulta_avista: 0,
        valor_consulta_cartao: 0,
        duracao_consulta_min: 60,
      });
      setFoto(null);
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) toast.error(e.issues[0].message);
      else toast.error(e?.message ?? "Falha ao cadastrar");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Novo profissional
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar profissional</DialogTitle>
          <DialogDescription>
            O profissional receberá acesso próprio ao painel com email e senha.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2 flex justify-center">
            <AvatarUploader
              bucket="profissionais"
              value={foto}
              nome={form.nome}
              size="lg"
              onChange={(next) => setFoto(next)}
            />
          </div>
          <Field label="Nome completo" span={2}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Email de acesso">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Senha inicial">
            <Input type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </Field>
          <Field label="Registro profissional">
            <Input value={form.registro_profissional} onChange={(e) => setForm({ ...form, registro_profissional: e.target.value })} />
          </Field>
          <Field label="Especialidade" span={2}>
            <Select
              value={form.especialidade_id}
              onValueChange={(v) => setForm({ ...form, especialidade_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {especialidades?.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valor à vista (R$)">
            <Input
              type="number"
              step="0.01"
              value={form.valor_consulta_avista}
              onChange={(e) => setForm({ ...form, valor_consulta_avista: Number(e.target.value) })}
            />
          </Field>
          <Field label="Valor cartão (R$)">
            <Input
              type="number"
              step="0.01"
              value={form.valor_consulta_cartao}
              onChange={(e) => setForm({ ...form, valor_consulta_cartao: Number(e.target.value) })}
            />
          </Field>
          <Field label="Duração (min)">
            <Input
              type="number"
              value={form.duracao_consulta_min}
              onChange={(e) => setForm({ ...form, duracao_consulta_min: Number(e.target.value) })}
            />
          </Field>
          <Field label="Formação">
            <Input value={form.formacao} onChange={(e) => setForm({ ...form, formacao: e.target.value })} />
          </Field>
          <Field label="Anos de experiência">
            <Input
              type="number"
              value={form.anos_experiencia}
              onChange={(e) => setForm({ ...form, anos_experiencia: Number(e.target.value) })}
            />
          </Field>
          <Field label="Descrição (mini biografia)" span={2}>
            <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <div className={span === 2 ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}


function FotoProfissionalDialog({
  id,
  nome,
  fotoUrl,
}: {
  id: string;
  nome: string;
  fotoUrl: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-3 w-full">
          Alterar foto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Foto de {nome}</DialogTitle>
          <DialogDescription>JPG, PNG ou WEBP de até 5 MB. A imagem é cortada em formato quadrado.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <AvatarUploader
            bucket="profissionais"
            value={fotoUrl}
            nome={nome}
            size="xl"
            onChange={async (next) => {
              const { error } = await supabase.from("profissionais").update({ foto_url: next }).eq("id", id);
              if (error) throw error;
              await qc.invalidateQueries({ queryKey: ["profissionais"] });
              await qc.invalidateQueries({ queryKey: ["profissionais-publicos"] });
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
