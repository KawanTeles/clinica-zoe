import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  firstDayOfMonthISO,
  firstDayOfWeekISO,
  firstDayOfYearISO,
  todayISO,
  valorLiquido,
} from "@/lib/financeiro-utils";

const SELECT_COM_RELACOES =
  "id, valor, desconto, juros, multa, status_pagamento, forma_pagamento, pago_em, created_at, vencimento, observacoes, " +
  "agendamento:agendamentos(id, data, hora_inicio, hora_fim, valor), " +
  "paciente:pacientes(id, nome, foto_url), " +
  "profissional:profissionais(id, nome, foto_url, especialidade_id, especialidade:especialidades(id, nome))";

export interface FinanceiroDimensao {
  id: string;
  nome: string;
  recebido: number;
  aberto: number;
  qtd: number;
}

export interface FinanceiroDashboardData {
  receitaDia: number;
  receitaSemana: number;
  receitaMes: number;
  receitaAno: number;
  receitaMesAnterior: number;
  /** Variação percentual do mês atual em relação ao mês anterior (null se não houver base de comparação). */
  variacaoMesPct: number | null;
  ticketMedio: number;
  totalConsultasPagasAno: number;
  totalAberto: number;
  totalParcial: number;
  qtdAberto: number;
  qtdParcial: number;
  porProfissional: FinanceiroDimensao[];
  porEspecialidade: FinanceiroDimensao[];
}

const EMPTY: FinanceiroDashboardData = {
  receitaDia: 0,
  receitaSemana: 0,
  receitaMes: 0,
  receitaAno: 0,
  receitaMesAnterior: 0,
  variacaoMesPct: null,
  ticketMedio: 0,
  totalConsultasPagasAno: 0,
  totalAberto: 0,
  totalParcial: 0,
  qtdAberto: 0,
  qtdParcial: 0,
  porProfissional: [],
  porEspecialidade: [],
};

function firstDayOfPreviousMonthISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfPreviousMonthISO() {
  const d = new Date();
  d.setDate(0); // último dia do mês anterior
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dashboard financeiro (Fase 1): KPIs de receita por período, ticket médio
 * e totais por profissional/especialidade — reduzidos no client sobre os
 * lançamentos do ano corrente + tudo que estiver em aberto/parcial (RLS já
 * limita PROFISSIONAL ao próprio recorte, ver skill `financial`).
 */
export function useFinanceiroDashboard() {
  const { session, ready } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-dashboard", session?.user?.id],
    enabled: ready && !!session,
    queryFn: async (): Promise<FinanceiroDashboardData> => {
      const anoInicio = firstDayOfYearISO();
      const mesAnteriorInicio = firstDayOfPreviousMonthISO();
      const mesAnteriorFim = lastDayOfPreviousMonthISO();

      const [pagosAno, abertosParciais, mesAnterior] = await Promise.all([
        supabase
          .from("financeiro")
          .select(SELECT_COM_RELACOES)
          .eq("status_pagamento", "PAGO")
          .gte("pago_em", `${anoInicio}T00:00:00`),
        supabase
          .from("financeiro")
          .select(SELECT_COM_RELACOES)
          .in("status_pagamento", ["ABERTO", "PARCIAL"]),
        supabase
          .from("financeiro")
          .select("id, valor, desconto, juros, multa, agendamento:agendamentos(valor)")
          .eq("status_pagamento", "PAGO")
          .gte("pago_em", `${mesAnteriorInicio}T00:00:00`)
          .lte("pago_em", `${mesAnteriorFim}T23:59:59`),
      ]);

      if (pagosAno.error) throw pagosAno.error;
      if (abertosParciais.error) throw abertosParciais.error;
      if (mesAnterior.error) throw mesAnterior.error;

      const hoje = todayISO();
      const semanaInicio = firstDayOfWeekISO();
      const mesInicio = firstDayOfMonthISO();

      const porProfissional = new Map<string, FinanceiroDimensao>();
      const porEspecialidade = new Map<string, FinanceiroDimensao>();

      let receitaDia = 0;
      let receitaSemana = 0;
      let receitaMes = 0;
      let receitaAno = 0;

      for (const r of pagosAno.data ?? []) {
        const v = valorLiquido(r as any);
        receitaAno += v;

        const pagoEmDia = (r as any).pago_em ? String((r as any).pago_em).slice(0, 10) : null;
        if (pagoEmDia === hoje) receitaDia += v;
        if (pagoEmDia && pagoEmDia >= semanaInicio) receitaSemana += v;
        if (pagoEmDia && pagoEmDia >= mesInicio) receitaMes += v;

        const prof = (r as any).profissional;
        const esp = (r as any).profissional?.especialidade;
        if (prof) {
          const cur = porProfissional.get(prof.id) ?? {
            id: prof.id,
            nome: prof.nome,
            recebido: 0,
            aberto: 0,
            qtd: 0,
          };
          cur.recebido += v;
          cur.qtd += 1;
          porProfissional.set(prof.id, cur);
        }
        if (esp) {
          const cur = porEspecialidade.get(esp.id) ?? {
            id: esp.id,
            nome: esp.nome,
            recebido: 0,
            aberto: 0,
            qtd: 0,
          };
          cur.recebido += v;
          cur.qtd += 1;
          porEspecialidade.set(esp.id, cur);
        }
      }

      let totalAberto = 0;
      let totalParcial = 0;
      let qtdAberto = 0;
      let qtdParcial = 0;
      for (const r of abertosParciais.data ?? []) {
        const v = valorLiquido(r as any);
        const status = (r as any).status_pagamento;
        if (status === "PARCIAL") {
          totalParcial += v;
          qtdParcial += 1;
        } else {
          totalAberto += v;
          qtdAberto += 1;
        }

        const prof = (r as any).profissional;
        const esp = (r as any).profissional?.especialidade;
        if (prof) {
          const cur = porProfissional.get(prof.id) ?? {
            id: prof.id,
            nome: prof.nome,
            recebido: 0,
            aberto: 0,
            qtd: 0,
          };
          cur.aberto += v;
          porProfissional.set(prof.id, cur);
        }
        if (esp) {
          const cur = porEspecialidade.get(esp.id) ?? {
            id: esp.id,
            nome: esp.nome,
            recebido: 0,
            aberto: 0,
            qtd: 0,
          };
          cur.aberto += v;
          porEspecialidade.set(esp.id, cur);
        }
      }

      const receitaMesAnterior = (mesAnterior.data ?? []).reduce(
        (s, r: any) => s + valorLiquido(r as any),
        0,
      );
      const variacaoMesPct =
        receitaMesAnterior > 0
          ? ((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100
          : null;

      const totalConsultasPagasAno = pagosAno.data?.length ?? 0;
      const ticketMedio = totalConsultasPagasAno > 0 ? receitaAno / totalConsultasPagasAno : 0;

      return {
        receitaDia,
        receitaSemana,
        receitaMes,
        receitaAno,
        receitaMesAnterior,
        variacaoMesPct,
        ticketMedio,
        totalConsultasPagasAno,
        totalAberto,
        totalParcial,
        qtdAberto,
        qtdParcial,
        porProfissional: Array.from(porProfissional.values()).sort(
          (a, b) => b.recebido - a.recebido,
        ),
        porEspecialidade: Array.from(porEspecialidade.values()).sort(
          (a, b) => b.recebido - a.recebido,
        ),
      };
    },
  });

  return { data: data ?? EMPTY, isLoading };
}

export interface FinanceiroEvolucaoMes {
  mes: string;
  recebido: number;
  aberto: number;
  qtd: number;
}

/** Evolução mensal (últimos N meses) — agregada no banco via `financeiro_evolucao_mensal` (ver migração da Fase 1). */
export function useFinanceiroEvolucaoMensal(meses = 12) {
  const { session, ready } = useAuth();

  return useQuery({
    queryKey: ["financeiro-evolucao-mensal", meses, session?.user?.id],
    enabled: ready && !!session,
    queryFn: async (): Promise<FinanceiroEvolucaoMes[]> => {
      const { data, error } = await supabase.rpc("financeiro_evolucao_mensal", { p_meses: meses });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        mes: r.mes,
        recebido: Number(r.recebido) || 0,
        aberto: Number(r.aberto) || 0,
        qtd: Number(r.qtd) || 0,
      }));
    },
  });
}
