import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, MessageSquare, Mail } from "lucide-react";

export const EVENTO_LABEL: Record<string, string> = {
  SOLICITACAO_NOVA: "Solicitação enviada",
  CONSULTA_APROVADA: "Consulta confirmada",
  CONSULTA_RECUSADA: "Consulta recusada",
  CONSULTA_CANCELADA: "Consulta cancelada",
  CONSULTA_REMARCADA: "Consulta remarcada",
  LEMBRETE_24H: "Lembrete enviado (24h)",
  LEMBRETE_2H: "Lembrete enviado (2h)",
  PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
};

const CANAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  INTERNO: Bell,
};

const STATUS_TONE: Record<string, string> = {
  ENVIADA:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  ENTREGUE:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  LIDO: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  RESPONDIDO:
    "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  PENDENTE:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  ENVIANDO:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  ERRO: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  CANCELADA: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Na fila",
  ENVIANDO: "Enviando",
  ENVIADA: "Enviada",
  ENTREGUE: "Entregue",
  LIDO: "Lida",
  RESPONDIDO: "Respondida",
  ERRO: "Erro",
  CANCELADA: "Cancelada",
};

type Props = {
  /** Notificações endereçadas a este usuário. */
  usuarioId?: string;
  /** Notificações ligadas às consultas deste paciente (por user_id do paciente). */
  pacienteUserId?: string;
  /** Notificações ligadas às consultas deste paciente (por id do cadastro). */
  pacienteId?: string;
  /** Notificações ligadas às consultas deste profissional. */
  profissionalUserId?: string;
  /** Notificações ligadas às consultas deste profissional (por id do cadastro). */
  profissionalId?: string;
  limit?: number;
};

/** Linha do tempo das notificações relacionadas às consultas. */
export function NotificacoesTimeline({
  usuarioId,
  pacienteUserId,
  pacienteId,
  profissionalUserId,
  profissionalId,
  limit = 60,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: [
      "notif-timeline",
      usuarioId,
      pacienteUserId,
      pacienteId,
      profissionalUserId,
      profissionalId,
      limit,
    ],
    queryFn: async () => {
      const ids = new Set<string>();

      if (pacienteId) {
        const { data: ags } = await supabase
          .from("agendamentos")
          .select("id")
          .eq("paciente_id", pacienteId);
        (ags ?? []).forEach((a) => ids.add(a.id));
      }

      if (profissionalId) {
        const { data: ags } = await supabase
          .from("agendamentos")
          .select("id")
          .eq("profissional_id", profissionalId);
        (ags ?? []).forEach((a) => ids.add(a.id));
      }

      if (pacienteUserId) {
        const [{ data: byUser }, { data: pac }] = await Promise.all([
          supabase.from("agendamentos").select("id").eq("cliente_user_id", pacienteUserId),
          supabase.from("pacientes").select("id").eq("user_id", pacienteUserId),
        ]);
        (byUser ?? []).forEach((a) => ids.add(a.id));
        const pacIds = (pac ?? []).map((p) => p.id);
        if (pacIds.length) {
          const { data: byPac } = await supabase
            .from("agendamentos")
            .select("id")
            .in("paciente_id", pacIds);
          (byPac ?? []).forEach((a) => ids.add(a.id));
        }
      }

      if (profissionalUserId) {
        const { data: prof } = await supabase
          .from("profissionais")
          .select("id")
          .eq("user_id", profissionalUserId);
        const profIds = (prof ?? []).map((p) => p.id);
        if (profIds.length) {
          const { data: ags } = await supabase
            .from("agendamentos")
            .select("id")
            .in("profissional_id", profIds);
          (ags ?? []).forEach((a) => ids.add(a.id));
        }
      }

      const agIds = [...ids];
      let query = supabase
        .from("notificacoes")
        .select(
          "id, titulo, mensagem, evento, canal, status_envio, created_at, enviado_em, entregue_em, lido_em, respondido_em, mensagem_recebida, ultimo_erro, provider, duracao_ms, agendamento_id",
        )

        .order("created_at", { ascending: false })
        .limit(limit);

      if (usuarioId && agIds.length) {
        query = query.or(`usuario_id.eq.${usuarioId},agendamento_id.in.(${agIds.join(",")})`);
      } else if (usuarioId) {
        query = query.eq("usuario_id", usuarioId);
      } else if (agIds.length) {
        query = query.in("agendamento_id", agIds);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma notificação registrada ainda.</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {data.map((n: any) => {
        const Icon = CANAL_ICON[n.canal] ?? Bell;
        return (
          <li key={n.id} className="relative">
            <span className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full border border-border bg-card">
              <Icon className="h-3 w-3 text-primary" />
            </span>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {EVENTO_LABEL[n.evento ?? ""] ?? n.titulo}
                </span>
                <Badge variant="outline" className={STATUS_TONE[n.status_envio] ?? ""}>
                  {STATUS_LABEL[n.status_envio] ?? n.status_envio}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {n.canal}
                </Badge>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.mensagem}</p>
              {n.mensagem_recebida && (
                <p className="mt-2 rounded-lg bg-surface-muted p-2 text-sm">
                  <span className="font-medium">Resposta recebida:</span> {n.mensagem_recebida}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                {n.enviado_em && (
                  <span>Enviada: {new Date(n.enviado_em).toLocaleString("pt-BR")}</span>
                )}
                {n.entregue_em && (
                  <span>Entregue: {new Date(n.entregue_em).toLocaleString("pt-BR")}</span>
                )}
                {n.lido_em && <span>Lida: {new Date(n.lido_em).toLocaleString("pt-BR")}</span>}
                {n.respondido_em && (
                  <span>Respondida: {new Date(n.respondido_em).toLocaleString("pt-BR")}</span>
                )}
                {n.provider && <span>Provider: {n.provider}</span>}
                {n.duracao_ms != null && <span>{n.duracao_ms} ms</span>}
              </div>
              {n.ultimo_erro && <p className="mt-1 text-xs text-red-600">Erro: {n.ultimo_erro}</p>}

            </div>
          </li>
        );
      })}
    </ol>
  );
}
