import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Users } from "lucide-react";
import { AvatarUploader } from "@/components/media/AvatarUploader";
import { PersonAvatar } from "@/lib/avatar";
import { WhatsAppLinha } from "@/components/contato/WhatsAppAviso";


export const Route = createFileRoute("/app/pacientes")({
  head: () => ({
    meta: [
      { title: "Pacientes — Clínica Zoe" },
      { name: "description", content: "Cadastro de pacientes." },
      { property: "og:title", content: "Pacientes — Clínica Zoe" },
      { property: "og:description", content: "Cadastro de pacientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PacientesPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  telefone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  data_nascimento: z.string().optional(),
  observacoes: z.string().optional(),
});

function PacientesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["pacientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nome, email, telefone, whatsapp, data_nascimento, observacoes, foto_url, created_at")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lista completa de pacientes cadastrados.</p>
        </div>
        <NovoPacienteDialog />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-base font-medium">Nenhum paciente cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                <p><WhatsAppLinha valor={p.whatsapp} /></p>
                {p.data_nascimento && <p>Nasc.: {new Date(p.data_nascimento).toLocaleDateString("pt-BR")}</p>}
                <EditarContatoPacienteDialog id={p.id} nome={p.nome} telefone={p.telefone} whatsapp={p.whatsapp} />
                <FotoPacienteDialog id={p.id} nome={p.nome} fotoUrl={p.foto_url} />
              </CardContent>

            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NovoPacienteDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", telefone: "", whatsapp: "", email: "", data_nascimento: "", observacoes: "" });
  const [foto, setFoto] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const { error } = await supabase.from("pacientes").insert({
        nome: parsed.nome,
        telefone: parsed.telefone || null,
        whatsapp: parsed.whatsapp || null,
        email: parsed.email || null,
        data_nascimento: parsed.data_nascimento || null,
        observacoes: parsed.observacoes || null,
        foto_url: foto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paciente cadastrado");
      qc.invalidateQueries({ queryKey: ["pacientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setForm({ nome: "", telefone: "", whatsapp: "", email: "", data_nascimento: "", observacoes: "" });

      setFoto(null);
      setOpen(false);
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
          <Plus className="h-4 w-4" /> Novo paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar paciente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2 flex justify-center">
            <AvatarUploader
              bucket="clientes"
              value={foto}
              nome={form.nome}
              size="lg"
              onChange={(next) => setFoto(next)}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input
              value={form.whatsapp}
              placeholder="(00) 00000-0000"
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">Usado nas notificações automáticas.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de nascimento</Label>
            <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
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


function FotoPacienteDialog({ id, nome, fotoUrl }: { id: string; nome: string; fotoUrl: string | null }) {
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
        </DialogHeader>
        <div className="flex justify-center py-2">
          <AvatarUploader
            bucket="clientes"
            value={fotoUrl}
            nome={nome}
            size="xl"
            onChange={async (next) => {
              const { error } = await supabase.from("pacientes").update({ foto_url: next }).eq("id", id);
              if (error) throw error;
              await qc.invalidateQueries({ queryKey: ["pacientes"] });
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
