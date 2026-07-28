import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploadField } from "@/components/media/ImageUploadField";
import { NotificacoesConfigCard } from "@/components/notificacoes/NotificacoesConfigCard";

import {
  CLINIC_SETTINGS_KEY,
  fetchClinicSettings,
  type ClinicHorario,
  type ClinicSettings,
} from "@/lib/clinic-settings";
import { Plus, Loader2, Settings, Trash2, Building2, Save, Share2 } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Clínica" },
      { name: "description", content: "Configurações do sistema e do site público." },
      { property: "og:title", content: "Configurações — Clínica" },
      { property: "og:description", content: "Configurações do sistema e do site público." },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conteúdo do site público, dados institucionais e catálogos do sistema.
        </p>
      </div>
      <ClinicaCard />
      <NotificacoesConfigCard />
      <EspecialidadesCard />
    </div>


  );
}

function ClinicaCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: CLINIC_SETTINGS_KEY,
    queryFn: fetchClinicSettings,
  });
  const [form, setForm] = useState<ClinicSettings | null>(null);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof ClinicSettings>(key: K, value: ClinicSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const payload = {
        nome: form.nome,
        tagline: form.tagline,
        logo_url: form.logo_url,
        hero_titulo: form.hero_titulo,
        hero_subtitulo: form.hero_subtitulo,
        hero_imagem_url: form.hero_imagem_url,
        og_imagem_url: form.og_imagem_url,
        texto_institucional: form.texto_institucional,
        endereco: form.endereco,
        telefone: form.telefone,
        whatsapp: form.whatsapp,
        email: form.email,
        horarios: form.horarios,
        redes_sociais: form.redes_sociais,
        latitude: form.latitude,
        longitude: form.longitude,
      };
      if (form.id) {
        const { error } = await (supabase as any)
          .from("configuracoes_clinica")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("configuracoes_clinica").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: CLINIC_SETTINGS_KEY });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return (
      <Card className="border-border shadow-soft">
        <CardContent className="grid place-items-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const horarios = form.horarios ?? [];
  const redes = form.redes_sociais ?? {};

  return (
    <Card className="border-border shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-primary" /> Dados da clínica e site público
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da clínica" value={form.nome} onChange={(v) => set("nome", v)} />
          <Field label="Slogan" value={form.tagline} onChange={(v) => set("tagline", v)} />
          <ImageUploadField
            label="Logo"
            hint="Exibida no cabeçalho e rodapé do site."
            prefix="logo"
            value={form.logo_url}
            onChange={(v) => set("logo_url", v)}
          />
          <ImageUploadField
            label="Imagem de compartilhamento (Open Graph)"
            hint="Aparece ao compartilhar o site em redes sociais."
            prefix="og"
            value={form.og_imagem_url}
            onChange={(v) => set("og_imagem_url", v)}
          />
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Destaque da página inicial</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" value={form.hero_titulo} onChange={(v) => set("hero_titulo", v)} />
            <ImageUploadField
              label="Imagem de fundo do destaque"
              prefix="hero"
              value={form.hero_imagem_url}
              onChange={(v) => set("hero_imagem_url", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subtítulo</Label>
            <Textarea
              rows={2}
              value={form.hero_subtitulo}
              onChange={(e) => set("hero_subtitulo", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Texto institucional (Sobre)</Label>
            <Textarea
              rows={4}
              value={form.texto_institucional}
              onChange={(e) => set("texto_institucional", e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Contato e localização</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Endereço" value={form.endereco} onChange={(v) => set("endereco", v)} />
            <Field label="E-mail" value={form.email} onChange={(v) => set("email", v)} />
            <Field label="Telefone" value={form.telefone} onChange={(v) => set("telefone", v)} />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
            <Field
              label="Latitude (mapa)"
              value={String(form.latitude ?? "")}
              onChange={(v) => set("latitude", Number(v) || 0)}
            />
            <Field
              label="Longitude (mapa)"
              value={String(form.longitude ?? "")}
              onChange={(v) => set("longitude", Number(v) || 0)}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Horário de funcionamento</h3>
          <div className="space-y-2">
            {horarios.map((h: ClinicHorario, i: number) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="sm:flex-1"
                  placeholder="Segunda a Sexta"
                  value={h.dias}
                  onChange={(e) => {
                    const next = [...horarios];
                    next[i] = { ...next[i], dias: e.target.value };
                    set("horarios", next);
                  }}
                />
                <Input
                  className="sm:flex-1"
                  placeholder="08:00 — 20:00"
                  value={h.horario}
                  onChange={(e) => {
                    const next = [...horarios];
                    next[i] = { ...next[i], horario: e.target.value };
                    set("horarios", next);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => set("horarios", horarios.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => set("horarios", [...horarios, { dias: "", horario: "" }])}
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar horário
          </Button>
        </section>

        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Share2 className="h-4 w-4 text-primary" /> Redes sociais
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["instagram", "facebook", "youtube", "tiktok", "linkedin"] as const).map((rede) => (
              <Field
                key={rede}
                label={rede.charAt(0).toUpperCase() + rede.slice(1)}
                value={(redes as any)[rede] ?? ""}
                onChange={(v) => set("redes_sociais", { ...redes, [rede]: v })}
              />
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function EspecialidadesCard() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");

  const { data } = useQuery({
    queryKey: ["especialidades-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("especialidades")
        .select("id, nome, descricao")
        .order("nome");
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
            {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{" "}
            Adicionar
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data?.map((e: any) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
            >
              <span className="truncate text-sm">{e.nome}</span>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
