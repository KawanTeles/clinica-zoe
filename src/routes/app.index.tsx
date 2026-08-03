import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Users,
  Stethoscope,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Ban,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  getWhatsAppUrl,
  formatPatientConfirmationMsg,
  openWhatsAppLink,
} from "@/lib/whatsapp-link";
import { valorLiquido as valorLancamento } from "@/lib/financeiro-utils";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Clínica Zoe" },
      { name: "description", content: "Visão geral da clínica e novas solicitações." },
      { property: "og:title", content: "Dashboard — Clínica Zoe" },
      { property: "og:description", content: "Visão geral da clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { nome, roles, user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("ADMIN");
  const isProfissional = roles.includes("PROFISSIONAL");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [
        profs,
        pacs,
        agHoje,
        agPend,
        agConfirmHoje,
        agCancHoje,
        finAberto,
        agHojeLista,
        pendentesLista,
      ] = await Promise.all([
        supabase.from("profissionais").select("id", { count: "exact", head: true }),
        supabase.from("pacientes").select("id", { count: "exact", head: true }),
        supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("data", today),
        supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
        supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("data", today)
          .eq("status", "APROVADO"),
        supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("data", today)
          .in("status", ["RECUSADO", "CANCELADO"]),
        supabase
          .from("financeiro")
          .select("valor, desconto, juros, multa, agendamento:agendamentos(valor)")
          .eq("status_pagamento", "ABERTO"),
        supabase
          .from("agendamentos")
          .select(
            "id, data, hora_inicio, hora_fim, status, paciente:pacientes(nome, telefone), profissional:profissionais(nome)",
          )
          .eq("data", today)
          .order("hora_inicio")
          .limit(6),
        supabase
          .from("agendamentos")
          .select(
            "id, data, hora_inicio, hora_fim, status, profissional_id, paciente:pacientes(nome, telefone), profissional:profissionais(nome, especialidade:especialidades(nome))",
          )
          .eq("status", "PENDENTE")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const totalAberto = (finAberto.data ?? []).reduce((s, r: any) => s + valorLancamento(r), 0);
      return {
        profissionais: profs.count ?? 0,
        pacientes: pacs.count ?? 0,
        agendamentosHoje: agHoje.count ?? 0,
        pendentes: agPend.count ?? 0,
        confirmadasHoje: agConfirmHoje.count ?? 0,
        canceladasHoje: agCancHoje.count ?? 0,
        aberto: totalAberto,
        consultasHoje: agHojeLista.data ?? [],
        solicitacoesPendentes: pendentesLista.data ?? [],
      };
    },
  });

  // Aprovação rápida direto do Dashboard
  const aprovarMut = useMutation({
    mutationFn: async (item: any) => {
      const { data: conflitos } = await supabase
        .from("agendamentos")
        .select("id")
        .eq("profissional_id", item.profissional_id)
        .eq("data", item.data)
        .eq("status", "APROVADO")
        .neq("id", item.id)
        .lt("hora_inicio", item.hora_fim)
        .gt("hora_fim", item.hora_inicio);

      if (conflitos && conflitos.length > 0) {
        throw new Error("Conflito: O profissional já tem consulta aprovada neste horário!");
      }

      const payload: any = {
        status: "APROVADO",
        aprovado_por: user?.id ?? null,
        aprovado_em: new Date().toISOString(),
      };

      const { error } = await supabase.from("agendamentos").update(payload).eq("id", item.id);

      if (error) {
        if (
          error.message?.includes("schema cache") ||
          error.message?.includes("aprovado") ||
          (error as any).code === "PGRST204"
        ) {
          const { error: fallbackErr } = await supabase
            .from("agendamentos")
            .update({ status: "APROVADO" })
            .eq("id", item.id);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw error;
        }
      }
    },
    onSuccess: (_, item) => {
      toast.success("Solicitação confirmada!");
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["solicitacoes"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });

      if (item.paciente?.telefone) {
        try {
          const msg = formatPatientConfirmationMsg({
            pacienteNome: item.paciente?.nome ?? "Paciente",
            pacienteTelefone: item.paciente?.telefone ?? "",
            profissionalNome: item.profissional?.nome ?? "Profissional",
            especialidadeNome: item.profissional?.especialidade?.nome ?? "Consulta",
            data: item.data,
            horario: `${String(item.hora_inicio).slice(0, 5)} - ${String(item.hora_fim).slice(0, 5)}`,
          });
          const url = getWhatsAppUrl(item.paciente.telefone, msg);
          openWhatsAppLink(url);
        } catch (e) {}
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao aprovar"),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá, {nome?.split(" ")[0] ?? "seja bem-vindo(a)"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Aqui está o resumo executivo da clínica hoje."
              : isProfissional
                ? "Aqui está o resumo dos seus atendimentos."
                : "Bem-vindo(a) à central da recepção."}
          </p>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/solicitacoes"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 text-xs font-semibold text-amber-700 dark:text-amber-300 shadow-xs transition hover:bg-amber-500/20"
          >
            <Clock className="h-4 w-4 text-amber-600" /> Solicitações ({stats?.pendentes ?? 0})
          </Link>
          <Link
            to="/app/agenda"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90"
          >
            <CalendarDays className="h-4 w-4" /> Nova Consulta
          </Link>
        </div>
      </div>

      {/* Grid de Indicadores em Tempo Real */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Solicitações Pendentes"
          value={stats?.pendentes ?? 0}
          accent="gold"
        />
        <StatCard
          icon={CheckCircle2}
          label="Confirmadas Hoje"
          value={stats?.confirmadasHoje ?? 0}
          accent="emerald"
        />
        <StatCard
          icon={XCircle}
          label="Canceladas Hoje"
          value={stats?.canceladasHoje ?? 0}
          accent="red"
        />
        <StatCard
          icon={CalendarDays}
          label="Total Agendados Hoje"
          value={stats?.agendamentosHoje ?? 0}
          accent="primary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Painel de Novas Solicitações Pendentes */}
        <Card className="lg:col-span-2 shadow-soft border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" /> Novas Solicitações Pendentes
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pedidos aguardando confirmação da recepção
              </p>
            </div>
            <Link
              to="/app/solicitacoes"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              Ver Central de Solicitações <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {!stats?.solicitacoesPendentes || stats.solicitacoesPendentes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-60" />
                <p className="text-sm font-medium text-foreground">Tudo limpo!</p>
                <p className="text-xs text-muted-foreground">
                  Não há solicitações pendentes no momento.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {stats.solicitacoesPendentes.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 font-semibold text-xs">
                        {String(item.hora_inicio).slice(0, 5)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {item.paciente?.nome ?? "Paciente"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.profissional?.nome} •{" "}
                          {item.profissional?.especialidade?.nome ?? "Consulta"} (
                          {new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                          )
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {item.paciente?.telefone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => openWhatsAppLink(getWhatsAppUrl(item.paciente.telefone))}
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => aprovarMut.mutate(item)}
                        disabled={aprovarMut.isPending}
                      >
                        <Check className="h-3.5 w-3.5" /> Confirmar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo Financeiro / Informação Adicional */}
        {isAdmin ? (
          <Card className="shadow-soft flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <DollarSign className="h-5 w-5 text-emerald-600" /> Receita em Aberto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    stats?.aberto ?? 0,
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total pendente de liquidação de consultas agendadas.
                </p>
              </div>

              <Link
                to="/app/financeiro"
                className="inline-flex w-full items-center justify-center rounded-xl bg-secondary py-2 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
              >
                Gerenciar Lançamentos Financeiros
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Resumo do Dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-border">
                <span className="text-muted-foreground">Confirmadas hoje:</span>
                <span className="font-semibold text-emerald-600">
                  {stats?.confirmadasHoje ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border">
                <span className="text-muted-foreground">Canceladas hoje:</span>
                <span className="font-semibold text-red-600">{stats?.canceladasHoje ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-muted-foreground">Pendentes na fila:</span>
                <span className="font-semibold text-amber-600">{stats?.pendentes ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "primary" | "gold" | "emerald" | "red";
}) {
  const styles = {
    gold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/15 text-red-600 dark:text-red-400",
    primary: "bg-primary/10 text-primary",
  };

  return (
    <Card className="shadow-soft transition-all duration-200 hover:shadow-elegant">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${styles[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
