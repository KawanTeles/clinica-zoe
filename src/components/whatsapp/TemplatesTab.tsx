import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listarTemplates,
  sincronizarTemplates,
  criarTemplate,
  excluirTemplate,
} from "@/lib/whatsapp-templates.functions";
import { VARIAVEIS_DISPONIVEIS } from "@/services/whatsapp/variables";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, Plus, Trash2, Loader2, FileCode2, Sparkles } from "lucide-react";

export const TEMPLATE_KEYS = {
  templates: ["wa", "templates"] as const,
  eventos: ["wa", "eventos"] as const,
};

const PRESETS: Array<{
  label: string;
  name: string;
  category: "UTILITY" | "MARKETING";
  header?: string;
  body: string;
  footer?: string;
}> = [
  {
    label: "Confirmação de consulta",
    name: "confirmacao_consulta",
    category: "UTILITY",
    body: `Olá {{PACIENTE}}.

Sua consulta foi confirmada.

Profissional:
{{PROFISSIONAL}}

Especialidade:
{{ESPECIALIDADE}}

Data:
{{DATA}}

Horário:
{{HORARIO}}

Local:
{{ENDERECO}}

Se precisar remarcar, responda esta mensagem.`,
    footer: "Clínica Zoe",
  },
  {
    label: "Solicitação recebida",
    name: "solicitacao_recebida",
    category: "UTILITY",
    body: `Olá {{PACIENTE}}.

Recebemos sua solicitação de agendamento.

Estamos verificando a disponibilidade do profissional.

Assim que confirmado você receberá outra mensagem.`,
    footer: "Clínica Zoe",
  },
  {
    label: "Consulta cancelada",
    name: "consulta_cancelada",
    category: "UTILITY",
    body: `Olá {{PACIENTE}}.

Sua consulta do dia {{DATA}} às {{HORARIO}} foi cancelada.

Caso queira remarcar, entre em contato conosco.`,
    footer: "Clínica Zoe",
  },
  {
    label: "Lembrete de consulta",
    name: "lembrete_consulta",
    category: "UTILITY",
    body: `Olá {{PACIENTE}}.

Lembramos que sua consulta será amanhã.

Profissional:
{{PROFISSIONAL}}

Horário:
{{HORARIO}}

Chegue com 15 minutos de antecedência.`,
    footer: "Clínica Zoe",
  },
  {
    label: "Consulta finalizada",
    name: "consulta_finalizada",
    category: "UTILITY",
    body: `Olá {{PACIENTE}}.

Obrigado por utilizar a {{CLINICA}}.

Esperamos que tenha sido bem atendido.

Sua opinião é muito importante.`,
    footer: "Clínica Zoe",
  },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED" || status === "DISABLED") return "destructive";
  if (status === "PAUSED") return "destructive";
  return "secondary";
}

export function TemplatesTab() {
  const qc = useQueryClient();
  const fnList = useServerFn(listarTemplates);
  const fnSync = useServerFn(sincronizarTemplates);
  const fnCreate = useServerFn(criarTemplate);
  const fnDelete = useServerFn(excluirTemplate);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    language: "pt_BR",
    category: "UTILITY" as "UTILITY" | "MARKETING" | "AUTHENTICATION",
    titulo_interno: "",
    header_text: "",
    body_text: "",
    footer_text: "Clínica Zoe",
  });

  const templatesQuery = useQuery({
    queryKey: TEMPLATE_KEYS.templates,
    queryFn: () => fnList({ data: undefined }),
    staleTime: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: () => fnSync({ data: undefined }),
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`${r.total} template(s) sincronizado(s) com a Meta.`);
      else toast.error(r.error ?? "Falha ao sincronizar templates.", { duration: 10000 });
      qc.invalidateQueries({ queryKey: TEMPLATE_KEYS.templates });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => fnCreate({ data: payload }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success(`Template enviado à Meta (status: ${r.status}). A aprovação costuma levar alguns minutos.`);
        setOpen(false);
      } else {
        toast.error(r.error ?? "A Meta recusou o template.", { duration: 14000 });
      }
      qc.invalidateQueries({ queryKey: TEMPLATE_KEYS.templates });
    },
    onError: (e: Error) => toast.error(e.message, { duration: 12000 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => fnDelete({ data: { name } }),
    onSuccess: () => {
      toast.success("Template removido.");
      qc.invalidateQueries({ queryKey: TEMPLATE_KEYS.templates });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templates = (templatesQuery.data ?? []) as any[];

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setForm({
      name: p.name,
      language: "pt_BR",
      category: p.category,
      titulo_interno: p.label,
      header_text: p.header ?? "",
      body_text: p.body,
      footer_text: p.footer ?? "",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5" /> Templates da Meta
            </CardTitle>
            <CardDescription>
              Catálogo sincronizado diretamente da WhatsApp Business Account. Fora da janela de 24h, somente templates
              APPROVED são entregues.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="gap-2"
            >
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Novo template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar template na Meta</DialogTitle>
                  <DialogDescription>
                    Use variáveis nomeadas entre chaves duplas. Elas são convertidas automaticamente para o formato
                    posicional exigido pela Meta.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Modelos prontos da clínica
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((p) => (
                        <Button key={p.name} size="sm" variant="secondary" onClick={() => applyPreset(p)}>
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="tpl-name">Nome (Meta)</Label>
                      <Input
                        id="tpl-name"
                        value={form.name}
                        placeholder="confirmacao_consulta"
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="tpl-titulo">Título interno</Label>
                      <Input
                        id="tpl-titulo"
                        value={form.titulo_interno}
                        onChange={(e) => setForm({ ...form, titulo_interno: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTILITY">UTILITY (transacional)</SelectItem>
                          <SelectItem value="MARKETING">MARKETING</SelectItem>
                          <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Idioma</Label>
                      <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt_BR">Português (pt_BR)</SelectItem>
                          <SelectItem value="en_US">Inglês (en_US)</SelectItem>
                          <SelectItem value="es_ES">Espanhol (es_ES)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="tpl-header">Cabeçalho (opcional, sem variáveis)</Label>
                    <Input
                      id="tpl-header"
                      value={form.header_text}
                      onChange={(e) => setForm({ ...form, header_text: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tpl-body">Corpo da mensagem</Label>
                    <Textarea
                      id="tpl-body"
                      rows={12}
                      value={form.body_text}
                      onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Variáveis disponíveis:{" "}
                      {VARIAVEIS_DISPONIVEIS.map((v) => `{{${v}}}`).join("  ")}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="tpl-footer">Rodapé (opcional)</Label>
                    <Input
                      id="tpl-footer"
                      value={form.footer_text}
                      onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
                    />
                  </div>

                  <Button
                    className="w-full gap-2"
                    disabled={createMutation.isPending || !form.name || form.body_text.length < 5}
                    onClick={() =>
                      createMutation.mutate({
                        name: form.name,
                        language: form.language,
                        category: form.category,
                        titulo_interno: form.titulo_interno || undefined,
                        header_text: form.header_text || undefined,
                        body_text: form.body_text,
                        footer_text: form.footer_text || undefined,
                      })
                    }
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Enviar para aprovação da Meta
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {templatesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando templates...
            </div>
          ) : templates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum template sincronizado ainda. Clique em “Sincronizar” para buscar na Meta.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Categoria</th>
                    <th className="py-2 pr-4">Idioma</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Qualidade</th>
                    <th className="py-2 pr-4">Variáveis</th>
                    <th className="py-2 pr-4">Sincronizado</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={`${t.name}-${t.language}`} className="border-b last:border-0 align-top">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{t.name}</div>
                        {t.titulo_interno ? (
                          <div className="text-xs text-muted-foreground">{t.titulo_interno}</div>
                        ) : null}
                        {t.rejected_reason ? (
                          <div className="text-xs text-destructive">{t.rejected_reason}</div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">{t.category}</td>
                      <td className="py-3 pr-4">{t.language}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                      </td>
                      <td className="py-3 pr-4">{t.quality_rating ?? "—"}</td>
                      <td className="py-3 pr-4 text-xs">
                        {Array.isArray(t.variaveis) && t.variaveis.length > 0 ? t.variaveis.join(", ") : "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {t.synced_at ? new Date(t.synced_at).toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="py-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(t.name)}
                          disabled={deleteMutation.isPending}
                          aria-label={`Excluir template ${t.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
