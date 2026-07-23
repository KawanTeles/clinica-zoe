import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Settings, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Clínica Zoe" },
      { name: "description", content: "Configurações do sistema." },
      { property: "og:title", content: "Configurações — Clínica Zoe" },
      { property: "og:description", content: "Configurações do sistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const { hasRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !hasRole("ADMIN")) navigate({ to: "/app" });
  }, [loading, hasRole, navigate]);

  const qc = useQueryClient();
  const [nome, setNome] = useState("");

  const { data } = useQuery({
    queryKey: ["especialidades-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("especialidades").select("id, nome, descricao").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("especialidades").insert({ nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Especialidade adicionada");
      qc.invalidateQueries({ queryKey: ["especialidades-config"] });
      qc.invalidateQueries({ queryKey: ["especialidades"] });
      setNome("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("especialidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["especialidades-config"] });
      qc.invalidateQueries({ queryKey: ["especialidades"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ajustes gerais e catálogos do sistema.</p>
      </div>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-primary" /> Especialidades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-1.5">
              <Label>Nova especialidade</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Odontologia" />
            </div>
            <Button className="sm:self-end" onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Adicionar
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {data?.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                <span className="truncate text-sm">{e.nome}</span>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
