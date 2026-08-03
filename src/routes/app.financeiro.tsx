import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FinanceiroKpis } from "@/components/financeiro/FinanceiroKpis";
import { FinanceiroGraficos } from "@/components/financeiro/FinanceiroGraficos";
import {
  FinanceiroFiltros,
  type FinanceiroFiltrosState,
} from "@/components/financeiro/FinanceiroFiltros";
import { TabelaLancamentos, type ParcelasResumo } from "@/components/financeiro/TabelaLancamentos";
import { RelatorioPorDimensaoCard } from "@/components/financeiro/RelatorioPorDimensaoCard";
import {
  RegistrarPagamentoDialog,
  type LancamentoParaPagamento,
} from "@/components/financeiro/RegistrarPagamentoDialog";
import { ParcelarDialog } from "@/components/financeiro/ParcelarDialog";
import { HistoricoLancamentoDialog } from "@/components/financeiro/HistoricoLancamentoDialog";
import { exportarLancamentosCSV } from "@/lib/financeiro-export";
import { firstDayOfMonthISO, todayISO, valorLiquido } from "@/lib/financeiro-utils";
import type { FinanceiroDimensao } from "@/lib/financeiro-dashboard";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Clínica Zoe" },
      { name: "description", content: "Painel financeiro." },
      { property: "og:title", content: "Financeiro — Clínica Zoe" },
      { property: "og:description", content: "Painel financeiro." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinanceiroPage,
});

const SELECT_COM_RELACOES =
  "id, valor, desconto, juros, multa, status_pagamento, forma_pagamento, pago_em, observacoes, vencimento, created_at, " +
  "agendamento:agendamentos(id, data, hora_inicio, hora_fim, valor), " +
  "paciente:pacientes(id, nome, foto_url), " +
  "profissional:profissionais(id, nome, foto_url, especialidade_id, especialidade:especialidades(id, nome))";

function FinanceiroPage() {
  const { loading, user, hasRole, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !hasAnyRole(["ADMIN", "PROFISSIONAL"])) {
      navigate({ to: "/app" });
    }
  }, [loading, hasAnyRole, navigate]);

  const isAdmin = hasRole("ADMIN");
  const isProfissional = hasRole("PROFISSIONAL") && !isAdmin;

  const [filtros, setFiltros] = useState<FinanceiroFiltrosState>({
    status: "TODOS",
    forma: "TODAS",
    profissionalId: "TODOS",
    especialidadeId: "TODAS",
    dataDe: firstDayOfMonthISO(),
    dataAte: todayISO(),
    busca: "",
  });

  const [pagamentoItem, setPagamentoItem] = useState<LancamentoParaPagamento | null>(null);
  const [parcelarItem, setParcelarItem] = useState<{ id: string; valor: number } | null>(null);
  const [historicoId, setHistoricoId] = useState<string | null>(null);
  const [confirmReabrir, setConfirmReabrir] = useState<any | null>(null);

  const setFiltro = <K extends keyof FinanceiroFiltrosState>(
    campo: K,
    valor: FinanceiroFiltrosState[K],
  ) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const resetFiltros = () =>
    setFiltros({
      status: "TODOS",
      forma: "TODAS",
      profissionalId: "TODOS",
      especialidadeId: "TODAS",
      dataDe: firstDayOfMonthISO(),
      dataAte: todayISO(),
      busca: "",
    });

  // Dropdown data
  const { data: profissionais } = useQuery({
    queryKey: ["fin-profissionais"],
    queryFn: async () => {
      const { data } = await supabase.from("profissionais").select("id, nome").order("nome");
      return data ?? [];
    },
    enabled: isAdmin,
  });
  const { data: especialidades } = useQuery({
    queryKey: ["fin-especialidades"],
    queryFn: async () => {
      const { data } = await supabase.from("especialidades").select("id, nome").order("nome");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // Main list
  const { data: rows, isLoading } = useQuery({
    queryKey: ["financeiro", filtros, isProfissional],
    queryFn: async () => {
      let q = supabase
        .from("financeiro")
        .select(SELECT_COM_RELACOES)
        .order("created_at", { ascending: false });
      if (filtros.status !== "TODOS") q = q.eq("status_pagamento", filtros.status as any);
      if (filtros.forma !== "TODAS") q = q.eq("forma_pagamento", filtros.forma as any);
      if (filtros.profissionalId !== "TODOS") q = q.eq("profissional_id", filtros.profissionalId);
      const { data, error } = await q;
      if (error) throw error;
      let list = data ?? [];

      list = list.filter((r: any) => {
        const d = r.agendamento?.data ?? (r.created_at ? String(r.created_at).slice(0, 10) : null);
        if (!d) return true;
        if (filtros.dataDe && d < filtros.dataDe) return false;
        if (filtros.dataAte && d > filtros.dataAte) return false;
        return true;
      });
      if (filtros.especialidadeId !== "TODAS") {
        list = list.filter(
          (r: any) => r.profissional?.especialidade_id === filtros.especialidadeId,
        );
      }
      if (filtros.busca.trim()) {
        const termo = filtros.busca.trim().toLowerCase();
        list = list.filter((r: any) => {
          const alvo =
            `${r.paciente?.nome ?? ""} ${r.profissional?.nome ?? ""} ${r.observacoes ?? ""}`.toLowerCase();
          return alvo.includes(termo);
        });
      }
      return list;
    },
    enabled: !!user,
  });

  const financeiroIds = useMemo(() => (rows ?? []).map((r: any) => r.id), [rows]);

  const { data: parcelasPorLancamento } = useQuery({
    queryKey: ["financeiro-parcelas-resumo", financeiroIds],
    enabled: financeiroIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_parcelas")
        .select("financeiro_id, status_pagamento")
        .in("financeiro_id", financeiroIds);
      if (error) throw error;
      const map = new Map<string, ParcelasResumo>();
      for (const p of data ?? []) {
        const cur = map.get(p.financeiro_id) ?? { total: 0, pagas: 0 };
        cur.total += 1;
        if (p.status_pagamento === "PAGO") cur.pagas += 1;
        map.set(p.financeiro_id, cur);
      }
      return map;
    },
  });

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ["financeiro"] });
    qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
    qc.invalidateQueries({ queryKey: ["financeiro-evolucao-mensal"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["financeiro-parcelas-resumo"] });
  };

  const cancelarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financeiro")
        .update({ status_pagamento: "CANCELADO" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento cancelado");
      invalidarTudo();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar"),
  });

  // "Reabrir": lançamento PAGO/PARCIAL -> estorna as baixas ativas (o trigger recalcula o status);
  // lançamento CANCELADO -> volta direto para ABERTO (nunca teve baixa a estornar).
  const reabrirMut = useMutation({
    mutationFn: async (row: any) => {
      if (row.status_pagamento === "CANCELADO") {
        const { error } = await supabase
          .from("financeiro")
          .update({ status_pagamento: "ABERTO" })
          .eq("id", row.id);
        if (error) throw error;
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("financeiro_pagamentos")
        .update({
          estornado: true,
          estornado_em: new Date().toISOString(),
          estornado_por: auth.user?.id ?? null,
        })
        .eq("financeiro_id", row.id)
        .eq("estornado", false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento reaberto");
      invalidarTudo();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reabrir"),
  });

  // Relatórios sobre os lançamentos filtrados (distinto dos KPIs fixos do ano corrente no topo).
  const relatorios = useMemo(() => {
    const porProf = new Map<string, FinanceiroDimensao>();
    const porEsp = new Map<string, FinanceiroDimensao>();
    for (const r of rows ?? []) {
      const v = valorLiquido(r);
      const status = (r as any).status_pagamento;
      const prof = (r as any).profissional;
      const esp = (r as any).profissional?.especialidade;
      if (prof) {
        const cur = porProf.get(prof.id) ?? {
          id: prof.id,
          nome: prof.nome,
          recebido: 0,
          aberto: 0,
          qtd: 0,
        };
        cur.qtd++;
        if (status === "PAGO") cur.recebido += v;
        if (status === "ABERTO" || status === "PARCIAL") cur.aberto += v;
        porProf.set(prof.id, cur);
      }
      if (esp) {
        const cur = porEsp.get(esp.id) ?? {
          id: esp.id,
          nome: esp.nome,
          recebido: 0,
          aberto: 0,
          qtd: 0,
        };
        cur.qtd++;
        if (status === "PAGO") cur.recebido += v;
        if (status === "ABERTO" || status === "PARCIAL") cur.aberto += v;
        porEsp.set(esp.id, cur);
      }
    }
    return {
      profissionais: Array.from(porProf.values()).sort((a, b) => b.recebido - a.recebido),
      especialidades: Array.from(porEsp.values()).sort((a, b) => b.recebido - a.recebido),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProfissional
              ? "Seus recebimentos, valores em aberto e histórico de pagamentos."
              : "Dashboard, contas a receber, parcelamento e relatórios da clínica."}
          </p>
        </div>
      </div>

      <FinanceiroKpis />
      <FinanceiroGraficos />

      <FinanceiroFiltros
        filtros={filtros}
        onChange={setFiltro}
        onReset={resetFiltros}
        onExport={() => exportarLancamentosCSV(rows ?? [])}
        isAdmin={isAdmin}
        profissionais={profissionais ?? []}
        especialidades={especialidades ?? []}
      />

      <Tabs value={filtros.status} onValueChange={(v) => setFiltro("status", v)}>
        <TabsList>
          <TabsTrigger value="TODOS">Todos</TabsTrigger>
          <TabsTrigger value="ABERTO">Em aberto</TabsTrigger>
          <TabsTrigger value="PARCIAL">Parcial</TabsTrigger>
          <TabsTrigger value="PAGO">Pagos</TabsTrigger>
          <TabsTrigger value="CANCELADO">Cancelados</TabsTrigger>
        </TabsList>
      </Tabs>

      <TabelaLancamentos
        rows={rows ?? []}
        isLoading={isLoading}
        isAdmin={isAdmin}
        parcelasPorLancamento={parcelasPorLancamento ?? new Map()}
        onRegistrarPagamento={(row) => setPagamentoItem(row)}
        onParcelar={(row) => setParcelarItem({ id: row.id, valor: valorLiquido(row) })}
        onHistorico={(id) => setHistoricoId(id)}
        onCancelar={(id) => cancelarMut.mutate(id)}
        onReabrir={(row) => setConfirmReabrir(row)}
      />

      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RelatorioPorDimensaoCard
            title="Totais por profissional (período filtrado)"
            rows={relatorios.profissionais}
          />
          <RelatorioPorDimensaoCard
            title="Totais por especialidade (período filtrado)"
            rows={relatorios.especialidades}
          />
        </div>
      )}

      <RegistrarPagamentoDialog
        item={pagamentoItem}
        onOpenChange={(o) => !o && setPagamentoItem(null)}
      />
      <ParcelarDialog
        financeiroId={parcelarItem?.id ?? null}
        valorTotal={parcelarItem?.valor ?? 0}
        onOpenChange={(o) => !o && setParcelarItem(null)}
      />
      <HistoricoLancamentoDialog
        financeiroId={historicoId}
        onOpenChange={(o) => !o && setHistoricoId(null)}
        isAdmin={isAdmin}
      />

      <AlertDialog open={!!confirmReabrir} onOpenChange={(o) => !o && setConfirmReabrir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmReabrir?.status_pagamento === "CANCELADO"
                ? "O lançamento voltará para o status Aberto."
                : "Os pagamentos registrados serão estornados (preservados no histórico) e o lançamento voltará para Aberto."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReabrir) reabrirMut.mutate(confirmReabrir);
                setConfirmReabrir(null);
              }}
            >
              Confirmar reabertura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
