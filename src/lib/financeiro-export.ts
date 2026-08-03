import {
  FORMA_PAGAMENTO_LABEL,
  STATUS_PAGAMENTO_LABEL,
  valorBruto,
  valorLiquido,
} from "@/lib/financeiro-utils";

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exporta os lançamentos filtrados como CSV (separador ";", padrão do
 * Excel em pt-BR). Sem dependência nova — gera o arquivo no client via
 * Blob, como combinado para a Fase 1 (PDF/Excel ficam para uma fase
 * futura, ver skill financial-architect).
 */
export function exportarLancamentosCSV(rows: any[]) {
  const header = [
    "Paciente",
    "Profissional",
    "Especialidade",
    "Data da consulta",
    "Valor bruto",
    "Desconto",
    "Juros",
    "Multa",
    "Valor líquido",
    "Status",
    "Forma de pagamento",
    "Pago em",
  ];

  const linhas = rows.map((r) => [
    r.paciente?.nome ?? "",
    r.profissional?.nome ?? "",
    r.profissional?.especialidade?.nome ?? "",
    r.agendamento?.data ?? "",
    valorBruto(r).toFixed(2).replace(".", ","),
    Number(r.desconto ?? 0)
      .toFixed(2)
      .replace(".", ","),
    Number(r.juros ?? 0)
      .toFixed(2)
      .replace(".", ","),
    Number(r.multa ?? 0)
      .toFixed(2)
      .replace(".", ","),
    valorLiquido(r).toFixed(2).replace(".", ","),
    STATUS_PAGAMENTO_LABEL[r.status_pagamento] ?? r.status_pagamento,
    r.forma_pagamento ? (FORMA_PAGAMENTO_LABEL[r.forma_pagamento] ?? r.forma_pagamento) : "",
    r.pago_em ? new Date(r.pago_em).toLocaleDateString("pt-BR") : "",
  ]);

  const csv = [header, ...linhas]
    .map((cols) => cols.map((c) => csvEscape(String(c))).join(";"))
    .join("\n");

  // BOM para o Excel reconhecer UTF-8 corretamente.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
