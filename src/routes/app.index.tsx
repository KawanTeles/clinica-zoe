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
      { title: "Dashboard — Clínica Zoe" },
      { name: "description", content: "Visão geral da clínica." },
      { property: "og:title", content: "Dashboard — Clínica Zoe" },
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
      const [profs, pacs, agHoje, agPend, finAberto] = await Promise.all([
        supabase.from("profissionais").select("id", { count: "exact", head: true }),
        supabase.from("pacientes").select("id", { count: "exact", head: true }),
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("data", today),
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("status", "PENDENTE"),
        supabase.from("financeiro").select("valor, agendamento:agendamentos(valor)").eq("status_pagamento", "ABERTO"),
      ]);
      const totalAberto = (finAberto.data ?? []).reduce((s, r: any) => s + valorLancamento(r), 0);
      return {
        profissionais: profs.count ?? 0,
        pacientes: pacs.count ?? 0,
        agendamentosHoje: agHoje.count ?? 0,
        pendentes: agPend.count ?? 0,
        aberto: totalAberto,
      };
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Olá, {nome?.split(" ")[0] ?? "seja bem-vindo(a)"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? "Aqui está o resumo da sua clínica hoje."
            : isProfissional
              ? "Aqui está o resumo da sua agenda."
              : "Bem-vindo(a) ao painel."}
        </p>
      </div>

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

      {isAdmin && (
        <Card className="border-border shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" /> Financeiro em aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats?.aberto ?? 0)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Total a receber de consultas ainda não pagas.</p>
          </CardContent>
        </Card>
      )}
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
    <Card className="border-border shadow-soft transition hover:shadow-elegant">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={
            accent === "gold"
              ? "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold"
              : "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
