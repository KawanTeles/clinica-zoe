import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  reenviarNotificacao,
  processarFilaNotificacoes,
  cancelarNotificacao,
} from "@/lib/notifications.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  MessageSquare,
  Mail,
  Inbox,
  RefreshCw,
  Send,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/app/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Clínica Zoe" },
      { name: "description", content: "Central de notificações e envio pela clínica." },
      { property: "og:title", content: "Notificações — Clínica Zoe" },
      { property: "og:description", content: "Central de notificações da Clínica Zoe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificacoesPage,
});

type Notif = {
  id: string;
  usuario_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  canal: "WHATSAPP" | "EMAIL" | "INTERNO";
  status_envio: "PENDENTE" | "ENVIANDO" | "ENVIADA" | "ERRO" | "CANCELADA";
  tentativas: number;
  ultimo_erro: string | null;
  enviado_em: string | null;
  evento: string | null;
  agendamento_id: string | null;
  destinatario_telefone: string | null;
  destinatario_email: string | null;
  created_at: string;
  lida: boolean;
};

const STATUS_COLOR: Record<Notif["status_envio"], string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  ENVIANDO: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  ENVIADA: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  ERRO: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  CANCELADA: "bg-muted text-muted-foreground border-border",
};
const CANAL_ICON: Record<Notif["canal"], React.ComponentType<{ className?: string }>> = {
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  INTERNO: Bell,
};
const EVENTO_LABEL: Record<string, string> = {
  SOLICITACAO_NOVA: "Nova solicitação",
  CONSULTA_APROVADA: "Consulta aprovada",
  CONSULTA_RECUSADA: "Consulta recusada",
  CONSULTA_CANCELADA: "Consulta cancelada",
  CONSULTA_REMARCADA: "Consulta remarcada",
  LEMBRETE_24H: "Lembrete 24h",
  PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function NotificacoesPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("ADMIN");
  const qc = useQueryClient();

  const [tab, setTab] = useState<"TODAS" | "PENDENTE" | "ENVIADA" | "ERRO" | "CANCELADA">("TODAS");
  const [canal, setCanal] = useState<"TODOS" | Notif["canal"]>("TODOS");
  const [busca, setBusca] = useState("");

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Notif[];
    },
  });

  const reenviarFn = useServerFn(reenviarNotificacao);
  const processarFn = useServerFn(processarFilaNotificacoes);
  const cancelarFn = useServerFn(cancelarNotificacao);

  const mReenviar = useMutation({
    mutationFn: (id: string) => reenviarFn({ data: { id } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Notificação reenviada");
      else toast.error(r?.error ?? "Falha ao reenviar");
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mProcessar = useMutation({
    mutationFn: () => processarFn({ data: { limit: 20 } }),
    onSuccess: (r: any) => {
      toast.success(`Fila processada (${r?.processed ?? 0} itens)`);
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mCancelar = useMutation({
    mutationFn: (id: string) => cancelarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Notificação cancelada");
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return notifs.filter((n) => {
      if (tab !== "TODAS" && n.status_envio !== tab) return false;
      if (canal !== "TODOS" && n.canal !== canal) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !n.titulo.toLowerCase().includes(q) &&
          !n.mensagem.toLowerCase().includes(q) &&
          !(n.destinatario_telefone ?? "").includes(q) &&
          !(n.destinatario_email ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [notifs, tab, canal, busca]);

  const stats = useMemo(() => {
    const s = { total: notifs.length, pendente: 0, enviada: 0, erro: 0, cancelada: 0 };
    for (const n of notifs) {
      if (n.status_envio === "PENDENTE" || n.status_envio === "ENVIANDO") s.pendente++;
      else if (n.status_envio === "ENVIADA") s.enviada++;
      else if (n.status_envio === "ERRO") s.erro++;
      else if (n.status_envio === "CANCELADA") s.cancelada++;
    }
    return s;
  }, [notifs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Central de eventos, envios internos e mensagens externas (WhatsApp / e-mail).
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => mProcessar.mutate()} disabled={mProcessar.isPending} className="gap-2">
            {mProcessar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Processar fila
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={Inbox} />
        <StatCard label="Pendentes" value={stats.pendente} icon={Loader2} tone="amber" />
        <StatCard label="Enviadas" value={stats.enviada} icon={CheckCircle2} tone="green" />
        <StatCard label="Erros" value={stats.erro} icon={AlertTriangle} tone="red" />
        <StatCard label="Canceladas" value={stats.cancelada} icon={XCircle} tone="slate" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Registros</CardTitle>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              placeholder="Buscar título, mensagem, contato…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="md:w-64"
            />
            <Select value={canal} onValueChange={(v) => setCanal(v as any)}>
              <SelectTrigger className="md:w-44"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os canais</SelectItem>
                <SelectItem value="INTERNO">Interno</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="EMAIL">E-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="TODAS">Todas</TabsTrigger>
              <TabsTrigger value="PENDENTE">Pendentes</TabsTrigger>
              <TabsTrigger value="ENVIADA">Enviadas</TabsTrigger>
              <TabsTrigger value="ERRO">Erros</TabsTrigger>
              <TabsTrigger value="CANCELADA">Canceladas</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid place-items-center py-12 text-sm text-muted-foreground">
              Nenhuma notificação encontrada.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => {
                const Icon = CANAL_ICON[n.canal];
                return (
                  <div
                    key={n.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-start md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{n.titulo}</span>
                          <Badge variant="outline" className={STATUS_COLOR[n.status_envio]}>
                            {n.status_envio}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {n.canal}
                          </Badge>
                          {n.evento && (
                            <span className="text-xs text-muted-foreground">
                              {EVENTO_LABEL[n.evento] ?? n.evento}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{n.mensagem}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Criada: {fmtDateTime(n.created_at)}</span>
                          <span>Enviada: {fmtDateTime(n.enviado_em)}</span>
                          <span>Tentativas: {n.tentativas}</span>
                          {(n.destinatario_telefone || n.destinatario_email) && (
                            <span>Contato: {n.destinatario_telefone ?? n.destinatario_email}</span>
                          )}
                        </div>
                        {n.ultimo_erro && (
                          <p className="mt-1 text-xs text-red-600">Erro: {n.ultimo_erro}</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && n.canal !== "INTERNO" && (
                      <div className="flex flex-wrap gap-2">
                        {n.status_envio !== "CANCELADA" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => mReenviar.mutate(n.id)}
                            disabled={mReenviar.isPending}
                            className="gap-1"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reenviar
                          </Button>
                        )}
                        {n.status_envio === "PENDENTE" || n.status_envio === "ERRO" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => mCancelar.mutate(n.id)}
                            disabled={mCancelar.isPending}
                            className="gap-1 text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "amber" | "green" | "red" | "slate";
}) {
  const toneCls =
    tone === "amber"
      ? "text-amber-600"
      : tone === "green"
      ? "text-emerald-600"
      : tone === "red"
      ? "text-red-600"
      : tone === "slate"
      ? "text-slate-500"
      : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${toneCls}`} />
      </CardContent>
    </Card>
  );
}
