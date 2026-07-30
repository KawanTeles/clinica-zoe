import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dispararNotificacoesAgendamento } from "@/lib/notifications.functions";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  User,
  Stethoscope,
  CreditCard,
  Send,
  MessageSquare,
  Eye,
  Globe,
  Check,
  Ban,
  FileText,
} from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL, fmtHora } from "@/lib/agenda-utils";
import { PersonAvatar } from "@/lib/avatar";
import {
  formatPatientConfirmationMsg,
  getWhatsAppUrl,
  openWhatsAppLink,
} from "@/lib/whatsapp-link";

export const Route = createFileRoute("/app/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações — Clínica" },
      { name: "description", content: "Central de solicitações de agendamento." },
      { property: "og:title", content: "Solicitações — Clínica" },
      { property: "og:description", content: "Central de solicitações de agendamento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SolicitacoesPage,
});

const FORMA_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_DEBITO: "Cartão de Débito",
  CARTAO_CREDITO: "Cartão de Crédito",
  OUTRO: "Outro",
};

function SolicitacoesPage() {
  const { loading, user, hasAnyRole, hasRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>("PENDENTE");
  const [detalhesItem, setDetalhesItem] = useState<any | null>(null);
  const [cancelarItem, setCancelarItem] = useState<any | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");

  useEffect(() => {
    if (!loading && !hasAnyRole(["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"])) {
      navigate({ to: "/app" });
    }
  }, [loading, hasAnyRole, navigate]);

  const isProfissional = hasRole("PROFISSIONAL") && !hasRole("ADMIN") && !hasRole("RECEPCIONISTA");
  const isRecepcionista = hasRole("RECEPCIONISTA") && !hasRole("ADMIN");
  const canAct = hasRole("ADMIN") || hasRole("PROFISSIONAL") || hasRole("RECEPCIONISTA");

  const { data: profId } = useQuery({
    queryKey: ["meu-profissional-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profissionais")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user && isProfissional,
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["solicitacoes", filtroStatus, profId ?? "ALL", isProfissional],
    queryFn: async () => {
      const selectFull = `id, data, hora_inicio, hora_fim, status, valor, forma_pagamento, observacoes, origem,
           aprovado_por, aprovado_em, cancelado_por, cancelado_em, motivo_cancelamento, created_at,
           profissional_id, paciente_id,
           paciente:pacientes(id,nome,telefone,email,foto_url),
           profissional:profissionais(id,nome,foto_url,especialidade:especialidades(nome))`;

      const selectBase = `id, data, hora_inicio, hora_fim, status, valor, forma_pagamento, observacoes, created_at,
           profissional_id, paciente_id,
           paciente:pacientes(id,nome,telefone,email,foto_url),
           profissional:profissionais(id,nome,foto_url,especialidade:especialidades(nome))`;

      let q = supabase.from("agendamentos").select(selectFull).order("created_at", { ascending: false });

      if (filtroStatus !== "TODOS") {
        if (filtroStatus === "CANCELADO") {
          q = q.in("status", ["RECUSADO", "CANCELADO"]);
        } else {
          q = q.eq("status", filtroStatus as any);
        }
      }
      if (isProfissional && profId) q = q.eq("profissional_id", profId);

      let { data, error } = await q;

      if (error && (error.message?.includes("schema cache") || error.message?.includes("origem") || (error as any).code === "PGRST204")) {
        let qFallback = supabase.from("agendamentos").select(selectBase).order("created_at", { ascending: false });
        if (filtroStatus !== "TODOS") {
          if (filtroStatus === "CANCELADO") {
            qFallback = qFallback.in("status", ["RECUSADO", "CANCELADO"]);
          } else {
            qFallback = qFallback.eq("status", filtroStatus as any);
          }
        }
        if (isProfissional && profId) qFallback = qFallback.eq("profissional_id", profId);

        const fallbackRes = await qFallback;
        data = fallbackRes.data as any;
        error = fallbackRes.error;
      }

      if (error) throw error;
      return data ?? [];
    },
    enabled: !isProfissional || !!profId || filtroStatus === "TODOS",
  });

  const dispararFn = useServerFn(dispararNotificacoesAgendamento);

  // Confirmar solicitação (verificando duplo agendamento)
  const aprovarMut = useMutation({
    mutationFn: async (agendamento: any) => {
      // Checar se já existe agendamento aprovado para o mesmo profissional no mesmo horário
      const { data: conflitos, error: cErr } = await supabase
        .from("agendamentos")
        .select("id")
        .eq("profissional_id", agendamento.profissional_id)
        .eq("data", agendamento.data)
        .eq("status", "APROVADO")
        .neq("id", agendamento.id)
        .lt("hora_inicio", agendamento.hora_fim)
        .gt("hora_fim", agendamento.hora_inicio);

      if (cErr) throw cErr;
      if (conflitos && conflitos.length > 0) {
        throw new Error("O profissional já possui uma consulta confirmada neste mesmo horário!");
      }

      const payload: any = {
        status: "APROVADO",
        aprovado_por: user?.id ?? null,
        aprovado_em: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("agendamentos")
        .update(payload)
        .eq("id", agendamento.id);

      if (error) {
        if (error.message?.includes("schema cache") || error.message?.includes("aprovado") || (error as any).code === "PGRST204") {
          const { error: fallbackErr } = await supabase
            .from("agendamentos")
            .update({ status: "APROVADO" })
            .eq("id", agendamento.id);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw error;
        }
      }
    },
    onSuccess: (_, agendamento) => {
      toast.success("Consulta confirmada e adicionada à agenda!");
      dispararFn({ data: { agendamentoId: agendamento.id } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["solicitacoes"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao confirmar consulta"),
  });

  // Cancelar solicitação
  const cancelarMut = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const payload: any = {
        status: "RECUSADO",
        cancelado_por: user?.id ?? null,
        cancelado_em: new Date().toISOString(),
        motivo_cancelamento: motivo || null,
      };

      const { error } = await supabase
        .from("agendamentos")
        .update(payload)
        .eq("id", id);

      if (error) {
        if (error.message?.includes("schema cache") || error.message?.includes("cancelado") || (error as any).code === "PGRST204") {
          const { error: fallbackErr } = await supabase
            .from("agendamentos")
            .update({ status: "RECUSADO" })
            .eq("id", id);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw error;
        }
      }
    },
    onSuccess: (_, vars) => {
      toast.success("Solicitação cancelada com sucesso.");
      dispararFn({ data: { agendamentoId: vars.id } }).catch(() => {});
      setCancelarItem(null);
      setMotivoCancelamento("");
      qc.invalidateQueries({ queryKey: ["solicitacoes"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar solicitação"),
  });

  const dataLabel = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

  const dataHoraLabel = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const contagem = useMemo(() => {
    const pend = rows?.filter((r: any) => r.status === "PENDENTE").length ?? 0;
    const aprov = rows?.filter((r: any) => r.status === "APROVADO").length ?? 0;
    const canc = rows?.filter((r: any) => r.status === "RECUSADO" || r.status === "CANCELADO").length ?? 0;
    return { pend, aprov, canc };
  }, [rows]);

  const enviarConfirmacaoWhatsApp = (a: any) => {
    const msg = formatPatientConfirmationMsg({
      pacienteNome: a.paciente?.nome ?? "Paciente",
      pacienteTelefone: a.paciente?.telefone ?? "",
      profissionalNome: a.profissional?.nome ?? "Profissional",
      especialidadeNome: a.profissional?.especialidade?.nome ?? "Consulta",
      data: a.data,
      horario: `${fmtHora(a.hora_inicio)} - ${fmtHora(a.hora_fim)}`,
    });
    const url = getWhatsAppUrl(a.paciente?.telefone, msg);
    openWhatsAppLink(url);
  };

  const abrirWhatsAppContato = (telefone?: string | null) => {
    const url = getWhatsAppUrl(telefone);
    openWhatsAppLink(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Solicitações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProfissional
              ? "Acompanhe e confirme os agendamentos das suas consultas."
              : isRecepcionista
                ? "Gestão de solicitações de agendamento recebidas pela recepção."
                : "Central de aprovações e controle de solicitações de agendamento."}
          </p>
        </div>
        {filtroStatus === "PENDENTE" && contagem.pend > 0 && (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm py-1 px-3">
            🟡 {contagem.pend} pendente{contagem.pend === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
        <TabsList className="bg-surface-muted">
          <TabsTrigger value="PENDENTE">Pendentes ({contagem.pend})</TabsTrigger>
          <TabsTrigger value="APROVADO">Aprovadas ({contagem.aprov})</TabsTrigger>
          <TabsTrigger value="CANCELADO">Canceladas ({contagem.canc})</TabsTrigger>
          <TabsTrigger value="TODOS">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            {rows?.length ?? 0} solicitação{(rows?.length ?? 0) === 1 ? "" : "ões"} encontrada{(rows?.length ?? 0) === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (rows?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <p className="text-base font-medium">Nenhuma solicitação encontrada</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Não há registros com os filtros selecionados no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows?.map((a: any) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-soft transition hover:shadow-elegant"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold capitalize">{dataLabel(a.data)}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {fmtHora(a.hora_inicio)} – {fmtHora(a.hora_fim)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1 border-border text-xs">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        Origem: {a.origem || "Site"}
                      </Badge>
                      <Badge variant="outline" className={STATUS_COLOR[a.status]}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
                    {/* Paciente */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente</p>
                      <div className="flex items-center gap-2">
                        <PersonAvatar size="xs" nome={a.paciente?.nome} fotoUrl={a.paciente?.foto_url} />
                        <span className="font-medium text-foreground truncate">{a.paciente?.nome ?? "Sem nome"}</span>
                      </div>
                      {a.paciente?.telefone && (
                        <p className="text-xs text-muted-foreground">Tel.: {a.paciente.telefone}</p>
                      )}
                      {a.paciente?.email && (
                        <p className="text-xs text-muted-foreground truncate">{a.paciente.email}</p>
                      )}
                    </div>

                    {/* Profissional */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atendimento</p>
                      <div className="flex items-center gap-2">
                        <PersonAvatar size="xs" nome={a.profissional?.nome} fotoUrl={a.profissional?.foto_url} className="h-6 w-6 text-[9px]" />
                        <span className="font-medium text-foreground truncate">{a.profissional?.nome}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.profissional?.especialidade?.nome ?? "Clínica Geral"}</p>
                      {a.valor != null && (
                        <p className="text-xs font-medium text-primary flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          R$ {Number(a.valor).toFixed(2)} {a.forma_pagamento ? `(${FORMA_LABEL[a.forma_pagamento] ?? a.forma_pagamento})` : ""}
                        </p>
                      )}
                    </div>

                    {/* Observações e Histórico */}
                    <div className="space-y-1 lg:col-span-1">
                      {a.observacoes && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground italic">"{a.observacoes}"</p>
                        </div>
                      )}
                      {a.status === "APROVADO" && (
                        <div className="mt-2 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300">
                          <p className="font-medium flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Confirmado
                          </p>
                          <p className="text-[11px]">Em: {dataHoraLabel(a.aprovado_em)}</p>
                        </div>
                      )}
                      {(a.status === "RECUSADO" || a.status === "CANCELADO") && (
                        <div className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
                          <p className="font-medium flex items-center gap-1">
                            <Ban className="h-3.5 w-3.5" /> Cancelado
                          </p>
                          <p className="text-[11px]">Em: {dataHoraLabel(a.cancelado_em)}</p>
                          {a.motivo_cancelamento && (
                            <p className="text-[11px] italic mt-0.5">Motivo: {a.motivo_cancelamento}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setDetalhesItem(a)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver detalhes
                      </Button>

                      {a.paciente?.telefone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => abrirWhatsAppContato(a.paciente?.telefone)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Falar no WhatsApp
                        </Button>
                      )}

                      {a.status === "APROVADO" && a.paciente?.telefone && (
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => enviarConfirmacaoWhatsApp(a)}
                        >
                          💬 Enviar confirmação
                        </Button>
                      )}
                    </div>

                    {a.status === "PENDENTE" && canAct && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                          onClick={() => setCancelarItem(a)}
                          disabled={aprovarMut.isPending || cancelarMut.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => aprovarMut.mutate(a)}
                          disabled={aprovarMut.isPending || cancelarMut.isPending}
                        >
                          {aprovarMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes da Solicitação */}
      {detalhesItem && (
        <Dialog open onOpenChange={(v) => !v && setDetalhesItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Detalhes da Solicitação
              </DialogTitle>
              <DialogDescription>
                Informações completas do agendamento #{detalhesItem.id.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={STATUS_COLOR[detalhesItem.status]}>
                  {STATUS_LABEL[detalhesItem.status]}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente</p>
                <p className="font-medium">{detalhesItem.paciente?.nome ?? "Não informado"}</p>
                <p className="text-xs text-muted-foreground">Telefone: {detalhesItem.paciente?.telefone ?? "—"}</p>
                <p className="text-xs text-muted-foreground">E-mail: {detalhesItem.paciente?.email ?? "—"}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profissional & Especialidade</p>
                <p className="font-medium">{detalhesItem.profissional?.nome}</p>
                <p className="text-xs text-muted-foreground">{detalhesItem.profissional?.especialidade?.nome ?? "—"}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Data</p>
                  <p className="font-medium">{dataLabel(detalhesItem.data)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Horário</p>
                  <p className="font-medium">{fmtHora(detalhesItem.hora_inicio)} - {fmtHora(detalhesItem.hora_fim)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Valor</p>
                  <p className="font-medium">R$ {Number(detalhesItem.valor ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Pagamento</p>
                  <p className="font-medium">{detalhesItem.forma_pagamento ? (FORMA_LABEL[detalhesItem.forma_pagamento] ?? detalhesItem.forma_pagamento) : "—"}</p>
                </div>
              </div>

              {detalhesItem.observacoes && (
                <div className="border-t border-border pt-2">
                  <p className="text-xs font-semibold text-muted-foreground">Observações</p>
                  <p className="text-xs italic text-muted-foreground mt-0.5">{detalhesItem.observacoes}</p>
                </div>
              )}

              <div className="border-t border-border pt-2 text-xs text-muted-foreground space-y-0.5">
                <p>Origem: <span className="font-medium text-foreground">{detalhesItem.origem || "Site"}</span></p>
                <p>Criado em: <span className="font-medium text-foreground">{dataHoraLabel(detalhesItem.created_at)}</span></p>
                {detalhesItem.aprovado_em && (
                  <p>Aprovado em: <span className="font-medium text-foreground">{dataHoraLabel(detalhesItem.aprovado_em)}</span></p>
                )}
                {detalhesItem.cancelado_em && (
                  <p>Cancelado em: <span className="font-medium text-foreground">{dataHoraLabel(detalhesItem.cancelado_em)}</span></p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetalhesItem(null)}>
                Fechar
              </Button>
              {detalhesItem.status === "APROVADO" && detalhesItem.paciente?.telefone && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => enviarConfirmacaoWhatsApp(detalhesItem)}>
                  💬 Enviar confirmação
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Cancelamento de Solicitação */}
      {cancelarItem && (
        <Dialog open onOpenChange={(v) => !v && setCancelarItem(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Cancelar solicitação</DialogTitle>
              <DialogDescription>
                Confirma o cancelamento da solicitação de {cancelarItem.paciente?.nome ?? "Paciente"}?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Motivo do cancelamento (opcional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Ex: Horário indisponível na agenda..."
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCancelarItem(null)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                disabled={cancelarMut.isPending}
                onClick={() => cancelarMut.mutate({ id: cancelarItem.id, motivo: motivoCancelamento })}
              >
                {cancelarMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
