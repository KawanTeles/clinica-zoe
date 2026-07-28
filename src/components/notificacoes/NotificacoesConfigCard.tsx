import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  obterConfigNotificacoes,
  salvarConfigNotificacoes,
  testarConexaoNotificacoes,
} from "@/lib/notifications.functions";
import { Loader2, MessageSquare, Save, PlugZap } from "lucide-react";

type Cfg = {
  destinatario_solicitacao: "PROFISSIONAL" | "RECEPCIONISTA" | "AMBOS";
  lembrete_24h_ativo: boolean;
  lembrete_2h_ativo: boolean;
  provider: "console" | "evolution" | "meta" | "twilio";
  provider_url: string;
  remetente: string;
  token_definido: boolean;
  conexao_status: string;
  conexao_testada_em: string | null;
  conexao_erro: string | null;
  janela_ativa: boolean;
  janela_inicio: string;
  janela_fim: string;
  templates: Record<string, string>;
};

const EVENTOS: Array<{ key: string; label: string }> = [
  { key: "SOLICITACAO_NOVA", label: "Nova solicitação" },
  { key: "CONSULTA_APROVADA", label: "Consulta confirmada" },
  { key: "CONSULTA_RECUSADA", label: "Solicitação recusada" },
  { key: "CONSULTA_CANCELADA", label: "Consulta cancelada" },
  { key: "CONSULTA_REMARCADA", label: "Consulta remarcada" },
  { key: "LEMBRETE_24H", label: "Lembrete 24 horas" },
  { key: "LEMBRETE_2H", label: "Lembrete 2 horas" },
  { key: "PAGAMENTO_CONFIRMADO", label: "Pagamento confirmado" },
];


export const NOTIF_CONFIG_KEY = ["notificacoes-config"] as const;

const PROVIDER_HINT: Record<Cfg["provider"], { url: string; remetente: string; token: string }> = {
  console: { url: "—", remetente: "—", token: "Não é necessário (modo de teste)" },
  evolution: {
    url: "https://sua-evolution.com",
    remetente: "nome-da-instancia",
    token: "apikey da Evolution",
  },
  meta: {
    url: "https://graph.facebook.com/v20.0",
    remetente: "ID do número (phone_number_id)",
    token: "Access token permanente",
  },
  twilio: {
    url: "—",
    remetente: "Número remetente (E.164)",
    token: "ACCOUNT_SID:AUTH_TOKEN",
  },
};

/** Configuração das notificações automáticas e do provider de WhatsApp. */
export function NotificacoesConfigCard() {
  const qc = useQueryClient();
  const obter = useServerFn(obterConfigNotificacoes);
  const salvar = useServerFn(salvarConfigNotificacoes);
  const testar = useServerFn(testarConexaoNotificacoes);

  const { data, isLoading } = useQuery({
    queryKey: NOTIF_CONFIG_KEY,
    queryFn: () => obter({ data: undefined as any }) as Promise<Cfg>,
  });

  const [form, setForm] = useState<Cfg | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const mSalvar = useMutation({
    mutationFn: async () => {
      if (!form) return;
      await salvar({
        data: {
          destinatario_solicitacao: form.destinatario_solicitacao,
          lembrete_24h_ativo: form.lembrete_24h_ativo,
          lembrete_2h_ativo: form.lembrete_2h_ativo,
          provider: form.provider,
          provider_url: form.provider_url,
          remetente: form.remetente,
          janela_ativa: form.janela_ativa,
          janela_inicio: form.janela_inicio,
          janela_fim: form.janela_fim,
          templates: form.templates ?? {},

          ...(token ? { provider_token: token } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("Configurações de notificações salvas");
      setToken("");
      qc.invalidateQueries({ queryKey: NOTIF_CONFIG_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mTestar = useMutation({
    mutationFn: () => testar({ data: undefined as any }) as Promise<{ ok: boolean; error?: string }>,
    onSuccess: (r) => {
      if (r.ok) toast.success("Conexão estabelecida com sucesso");
      else toast.error(r.error ?? "Falha na conexão");
      qc.invalidateQueries({ queryKey: NOTIF_CONFIG_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const hint = PROVIDER_HINT[form.provider];
  const statusTone =
    form.conexao_status === "CONECTADO"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
      : form.conexao_status === "ERRO"
        ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30"
        : "bg-muted text-muted-foreground border-border";

  return (
    <Card className="border-border shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" /> Notificações e WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Nova solicitação de agendamento</h3>
          <div className="max-w-md space-y-1.5">
            <Label>Quem recebe o aviso</Label>
            <Select
              value={form.destinatario_solicitacao}
              onValueChange={(v) => set("destinatario_solicitacao", v as Cfg["destinatario_solicitacao"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROFISSIONAL">Profissional</SelectItem>
                <SelectItem value="RECEPCIONISTA">Recepcionista</SelectItem>
                <SelectItem value="AMBOS">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vale imediatamente para as próximas solicitações recebidas pelo site.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Lembretes automáticos</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Lembrete 24 horas antes da consulta"
              checked={form.lembrete_24h_ativo}
              onChange={(v) => set("lembrete_24h_ativo", v)}
            />
            <ToggleRow
              label="Lembrete opcional 2 horas antes da consulta"
              checked={form.lembrete_2h_ativo}
              onChange={(v) => set("lembrete_2h_ativo", v)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Provider de mensagens</h3>
            <Badge variant="outline" className={statusTone}>
              {form.conexao_status === "CONECTADO"
                ? "Conectado"
                : form.conexao_status === "ERRO"
                  ? "Erro de conexão"
                  : "Não testada"}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => set("provider", v as Cfg["provider"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="console">Simulado (log interno)</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                  <SelectItem value="meta">Meta WhatsApp Cloud API</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL da API</Label>
              <Input
                value={form.provider_url}
                placeholder={hint.url}
                onChange={(e) => set("provider_url", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Número remetente / instância</Label>
              <Input
                value={form.remetente}
                placeholder={hint.remetente}
                onChange={(e) => set("remetente", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Token</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={token}
                placeholder={form.token_definido ? "•••••••• (salvo)" : hint.token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O token fica somente no servidor e nunca é exibido novamente.
              </p>
            </div>
          </div>
          {form.conexao_erro && (
            <p className="text-xs text-red-600">Último erro: {form.conexao_erro}</p>
          )}
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => mTestar.mutate()} disabled={mTestar.isPending}>
            {mTestar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="mr-2 h-4 w-4" />
            )}
            Testar conexão
          </Button>
          <Button onClick={() => mSalvar.mutate()} disabled={mSalvar.isPending}>
            {mSalvar.isPending ? (
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

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
