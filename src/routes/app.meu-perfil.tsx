import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AvatarUploader } from "@/components/media/AvatarUploader";
import { SecurityCard } from "@/components/security/SecurityCard";
import { NotificacoesTimeline } from "@/components/notificacoes/NotificacoesTimeline";



export const Route = createFileRoute("/app/meu-perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — Clínica" },
      { name: "description", content: "Seus dados profissionais." },
      { property: "og:title", content: "Meu Perfil — Clínica" },
      { property: "og:description", content: "Seus dados profissionais." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeuPerfil,
});

function MeuPerfil() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["meu-profissional", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ telefone: "", whatsapp: "", descricao: "", registro_profissional: "", formacao: "", anos_experiencia: "" });
  useEffect(() => {
    if (data) {
      setForm({
        telefone: data.telefone ?? "",
        whatsapp: data.whatsapp ?? "",

        descricao: data.descricao ?? "",
        registro_profissional: data.registro_profissional ?? "",
        formacao: data.formacao ?? "",
        anos_experiencia: data.anos_experiencia != null ? String(data.anos_experiencia) : "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Perfil profissional não encontrado. Contate o administrador.");
      const { error } = await supabase
        .from("profissionais")
        .update({
          telefone: form.telefone || null,
          whatsapp: form.whatsapp || null,

          descricao: form.descricao || null,
          registro_profissional: form.registro_profissional || null,
          formacao: form.formacao || null,
          anos_experiencia: form.anos_experiencia ? Number(form.anos_experiencia) : null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["meu-profissional", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atualize seus dados profissionais.</p>
      </div>
      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">{data?.nome ?? "—"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex justify-center border-b border-border pb-6">
            <AvatarUploader
              bucket="profissionais"
              value={data?.foto_url ?? null}
              nome={data?.nome}
              size="xl"
              disabled={!data}
              onChange={async (next) => {
                if (!data) return;
                const { error } = await supabase
                  .from("profissionais")
                  .update({ foto_url: next })
                  .eq("id", data.id);
                if (error) throw error;
                await qc.invalidateQueries({ queryKey: ["meu-profissional", user?.id] });
                await qc.invalidateQueries({ queryKey: ["profissionais"] });
              }}
            />
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
            <p className="text-[11px] text-muted-foreground">
              Sem WhatsApp você não receberá notificações automáticas.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Registro profissional</Label>
            <Input value={form.registro_profissional} onChange={(e) => setForm({ ...form, registro_profissional: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Formação</Label>
            <Input value={form.formacao} onChange={(e) => setForm({ ...form, formacao: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Anos de experiência</Label>
            <Input
              type="number"
              value={form.anos_experiencia}
              onChange={(e) => setForm({ ...form, anos_experiencia: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Descrição (mini biografia)</Label>
            <Textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Histórico de notificações</CardTitle>
        </CardHeader>
        <CardContent>
          {user && <NotificacoesTimeline usuarioId={user.id} profissionalUserId={user.id} limit={40} />}
        </CardContent>
      </Card>

      <SecurityCard className="border-border shadow-soft" />
    </div>
  );
}

