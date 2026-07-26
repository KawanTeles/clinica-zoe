import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { todayISO } from "@/lib/agenda-utils";

export interface SidebarBadges {
  solicitacoes: number;
  notificacoes: number;
  financeiro: number;
  agenda: number;
}

const EMPTY: SidebarBadges = { solicitacoes: 0, notificacoes: 0, financeiro: 0, agenda: 0 };

/**
 * Contadores para os badges da sidebar.
 * Somente leitura — o RLS já limita cada papel aos seus próprios registros.
 */
export function useSidebarBadges(): SidebarBadges {
  const { session, ready, roles } = useAuth();
  const enabled = ready && !!session;
  const canFinanceiro = roles.includes("ADMIN") || roles.includes("PROFISSIONAL");

  const { data } = useQuery({
    queryKey: ["sidebar-badges", session?.user?.id, canFinanceiro],
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    queryFn: async (): Promise<SidebarBadges> => {
      const hoje = todayISO();
      const [pend, naoLidas, aberto, agHoje] = await Promise.all([
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("status", "PENDENTE"),
        supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("lida", false),
        canFinanceiro
          ? supabase.from("financeiro").select("id", { count: "exact", head: true }).eq("status_pagamento", "ABERTO")
          : Promise.resolve({ count: 0 } as { count: number | null }),
        supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("data", hoje)
          .in("status", ["APROVADO", "REMARCADO"]),
      ]);

      return {
        solicitacoes: pend.count ?? 0,
        notificacoes: naoLidas.count ?? 0,
        financeiro: aberto.count ?? 0,
        agenda: agHoje.count ?? 0,
      };
    },
  });

  return data ?? EMPTY;
}
