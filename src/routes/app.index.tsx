import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Stethoscope, DollarSign, Clock } from "lucide-react";

function valorLancamento(row: any) {
  const valorCongelado = row?.agendamento?.valor;
  return valorCongelado == null ? Number(row?.valor ?? 0) : Number(valorCongelado) || 0;
}

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Clínica" },
      { name: "description", content: "Visão geral da clínica." },
      { property: "og:title", content: "Dashboard — Clínica" },
      { property: "og:description", content: "Visão geral da clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { nome, roles } = useAuth();
  const isAdmin = roles.includes("ADMIN");
  const isProfissional = roles.includes("PROFISSIONAL");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [profs, pacs, agHoje, agPend, finAberto, agHojeLista] = await Promise.all([
        supabase.from("profissionais").select("id", { count: "exact", head: true }),
        supabase.from("pacientes").select("id", { count: "exact", head: true }),
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("data", today),
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("status", "PENDENTE"),
        supabase.from("financeiro").select("valor, agendamento:agendamentos(valor)").eq("status_pagamento", "ABERTO"),
        supabase
          .from("agendamentos")
          .select("id, data, hora_inicio, status, pacientes(nome), profissionais(nome)")
          .eq("data", today)
          .order("hora_inicio")
          .limit(6),
      ]);
      const totalAberto = (finAberto.data ?? []).reduce((s, r: any) => s + valorLancamento(r), 0);
      return {
        profissionais: profs.count ?? 0,
        pacientes: pacs.count ?? 0,
        agendamentosHoje: agHoje.count ?? 0,
        pendentes: agPend.count ?? 0,
        aberto: totalAberto,
        consultasHoje: agHojeLista.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Olá, {nome?.split(" ")[0] ?? "seja bem-vindo(a)"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Aqui está o resumo executivo da clínica hoje."
              : isProfissional
                ? "Aqui está o resumo dos seus atendimentos."
                : "Bem-vindo(a) ao painel da clínica."}
          </p>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/app/agenda"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90"
          >
            <CalendarDays className="h-4 w-4" /> Nova Consulta
          </a>
          <a
            href="/app/solicitacoes"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-secondary"
          >
            <Clock className="h-4 w-4 text-amber-600" /> Solicitações ({stats?.pendentes ?? 0})
          </a>
        </div>
      </div>

      {/* Grid de Estatísticas Principal */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Agendamentos hoje" value={stats?.agendamentosHoje ?? 0} accent="primary" />
        <StatCard icon={Clock} label="Solicitações pendentes" value={stats?.pendentes ?? 0} accent="gold" />
        {isAdmin && (
          <>
            <StatCard icon={Stethoscope} label="Profissionais" value={stats?.profissionais ?? 0} accent="primary" />
            <StatCard icon={Users} label="Pacientes" value={stats?.pacientes ?? 0} accent="primary" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Próximas Consultas do Dia */}
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Consultas Agendadas para Hoje</CardTitle>
            <a href="/app/agenda" className="text-xs font-medium text-primary hover:underline">
              Ver agenda completa →
            </a>
          </CardHeader>
          <CardContent>
            {(!stats?.consultasHoje || stats.consultasHoje.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CalendarDays className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">Nenhuma consulta para hoje.</p>
                <p className="text-xs text-muted-foreground">Novas solicitações aparecerão aqui automaticamente.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {stats.consultasHoje.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary font-semibold text-xs">
                        {String(c.hora_inicio).slice(0, 5)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{c.pacientes?.nome ?? "Paciente"}</p>
                        <p className="text-xs text-muted-foreground">{c.profissionais?.nome ?? "Profissional"}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        c.status === "APROVADO"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : c.status === "PENDENTE"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                            : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financeiro em Aberto */}
        {isAdmin && (
          <Card className="shadow-soft flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <DollarSign className="h-5 w-5 text-emerald-600" /> Receita em Aberto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats?.aberto ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Total pendente de liquidação de consultas agendadas.</p>
              </div>

              <a
                href="/app/financeiro"
                className="inline-flex w-full items-center justify-center rounded-xl bg-secondary py-2 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
              >
                Gerenciar Lançamentos Financeiros
              </a>
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
  accent: "primary" | "gold";
}) {
  return (
    <Card className="shadow-soft transition-all duration-200 hover:shadow-elegant">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={
            accent === "gold"
              ? "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold"
              : "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
