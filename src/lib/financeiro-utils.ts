// Helpers compartilhados do módulo Financeiro (Fase 1 — Contas a Receber).
// Ver .claude/skills/financial/ e .claude/skills/financial-architect/.

export const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_DEBITO: "Cartão de Débito",
  CARTAO_CREDITO: "Cartão de Crédito",
  OUTRO: "Outro",
};

export const STATUS_PAGAMENTO_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  PARCIAL: "Parcial",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

export const STATUS_PAGAMENTO_COLOR: Record<string, string> = {
  ABERTO: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  PARCIAL: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  PAGO: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  CANCELADO: "bg-muted text-muted-foreground border-border",
};

export function brl(n: number) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type ValorLancamentoInput = {
  valor?: number | null;
  desconto?: number | null;
  juros?: number | null;
  multa?: number | null;
  agendamento?: { valor?: number | null } | null;
};

/** Valor congelado do lançamento: prioriza o valor do agendamento sobre o de `financeiro` (ver skill `financial`). */
export function valorBruto(row: ValorLancamentoInput): number {
  const congelado = row?.agendamento?.valor;
  return congelado == null ? Number(row?.valor ?? 0) || 0 : Number(congelado) || 0;
}

/** Valor efetivamente devido, aplicando desconto/juros/multa do lançamento sobre o valor bruto. */
export function valorLiquido(row: ValorLancamentoInput): number {
  const bruto = valorBruto(row);
  const desconto = Number(row?.desconto ?? 0) || 0;
  const juros = Number(row?.juros ?? 0) || 0;
  const multa = Number(row?.multa ?? 0) || 0;
  return bruto - desconto + juros + multa;
}

/** Mantido por compatibilidade com o nome usado historicamente na rota — alias de `valorLiquido`. */
export const valorLancamento = valorLiquido;

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function firstDayOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function firstDayOfWeekISO() {
  const d = new Date();
  const dow = d.getDay(); // 0 = domingo
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function firstDayOfYearISO() {
  return `${new Date().getFullYear()}-01-01`;
}
