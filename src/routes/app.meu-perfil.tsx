import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AvatarUploader } from "@/components/media/AvatarUploader";


export const Route = createFileRoute("/app/meu-perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — Clínica Zoe" },
      { name: "description", content: "Seus dados profissionais." },
      { property: "og:title", content: "Meu Perfil — Clínica Zoe" },
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

  const [form, setForm] = useState({ telefone: "", descricao: "", registro_profissional: "" });
  useEffect(() => {
    if (data) {
      setForm({
        telefone: data.telefone ?? "",
        descricao: data.descricao ?? "",
        registro_profissional: data.registro_profissional ?? "",
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
          descricao: form.descricao || null,
          registro_profissional: form.registro_profissional || null,
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
            <Label>Registro profissional</Label>
            <Input value={form.registro_profissional} onChange={(e) => setForm({ ...form, registro_profissional: e.target.value })} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
