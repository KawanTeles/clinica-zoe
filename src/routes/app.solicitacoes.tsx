import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, CheckCircle2, XCircle, Loader2, Clock, User, Stethoscope, CreditCard } from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL, fmtHora } from "@/lib/agenda-utils";

export const Route = createFileRoute("/app/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações — Clínica Zoe" },
      { name: "description", content: "Solicitações de consulta pendentes." },
      { property: "og:title", content: "Solicitações — Clínica Zoe" },
      { property: "og:description", content: "Solicitações de consulta pendentes." },
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

  useEffect(() => {
    if (!loading && !hasAnyRole(["ADMIN", "RECEPCIONISTA", "PROFISSIONAL"])) {
      navigate({ to: "/app" });
    }
  }, [loading, hasAnyRole, navigate]);

  const isProfissional = hasRole("PROFISSIONAL") && !hasRole("ADMIN") && !hasRole("RECEPCIONISTA");
  const isRecepcionista = hasRole("RECEPCIONISTA") && !hasRole("ADMIN");
  const canAct = hasRole("ADMIN") || hasRole("PROFISSIONAL");

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
      let q = supabase
        .from("agendamentos")
        .select(
          "id, data, hora_inicio, hora_fim, status, valor, forma_pagamento, observacoes, profissional_id, paciente:pacientes(id,nome,telefone,foto_url), profissional:profissionais(id,nome,foto_url,especialidade:especialidades(nome))",
        )
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (filtroStatus !== "TODOS") q = q.eq("status", filtroStatus as any);
      if (isProfissional && profId) q = q.eq("profissional_id", profId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isProfissional || !!profId || filtroStatus === "TODOS",
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APROVADO" | "RECUSADO" }) => {
      const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "APROVADO" ? "Consulta aprovada" : "Consulta recusada");
      qc.invalidateQueries({ queryKey: ["solicitacoes"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const dataLabel = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

  const contagem = useMemo(() => {
    const pend = rows?.filter((r: any) => r.status === "PENDENTE").length ?? 0;
    return { pend };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Solicitações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProfissional
              ? "Consultas aguardando sua confirmação."
              : isRecepcionista
                ? "Acompanhamento das solicitações da clínica (somente leitura)."
                : "Todas as solicitações recebidas na clínica."}
          </p>
        </div>
        {filtroStatus === "PENDENTE" && (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {contagem.pend} pendente{contagem.pend === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
        <TabsList>
          <TabsTrigger value="PENDENTE">Pendentes</TabsTrigger>
          <TabsTrigger value="APROVADO">Aprovadas</TabsTrigger>
          <TabsTrigger value="RECUSADO">Recusadas</TabsTrigger>
          <TabsTrigger value="TODOS">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            {rows?.length ?? 0} resultado{(rows?.length ?? 0) === 1 ? "" : "s"}
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
              <p className="text-base font-medium">Nenhuma solicitação</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Quando houver novos pedidos de consulta, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows?.map((a: any) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant md:flex-row md:items-center"
                >
                  <div className="flex w-full items-center gap-3 md:w-auto">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize">{dataLabel(a.data)}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {fmtHora(a.hora_inicio)}–{fmtHora(a.hora_fim)}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {a.paciente?.nome ?? "Sem paciente"}
                      </span>
                      <Badge variant="outline" className={STATUS_COLOR[a.status]}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" />
                        {a.profissional?.nome} • {a.profissional?.especialidade?.nome ?? "—"}
                      </span>
                      {a.valor != null && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          R$ {Number(a.valor).toFixed(2)}
                          {a.forma_pagamento ? ` • ${FORMA_LABEL[a.forma_pagamento] ?? a.forma_pagamento}` : ""}
                        </span>
                      )}
                    </p>
                    {a.observacoes && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">Obs.: {a.observacoes}</p>
                    )}
                  </div>

                  {a.status === "PENDENTE" && canAct && (
                    <div className="flex w-full gap-2 md:w-auto">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive md:flex-none"
                        onClick={() => statusMut.mutate({ id: a.id, status: "RECUSADO" })}
                        disabled={statusMut.isPending}
                      >
                        <XCircle className="h-4 w-4" /> Recusar
                      </Button>
                      <Button
                        className="flex-1 gap-2 md:flex-none"
                        onClick={() => statusMut.mutate({ id: a.id, status: "APROVADO" })}
                        disabled={statusMut.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Aceitar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
