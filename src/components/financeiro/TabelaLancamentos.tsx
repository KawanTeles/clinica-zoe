import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  Clock,
  DollarSign,
  History,
  Layers,
  Loader2,
  MoreVertical,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { fmtHora } from "@/lib/agenda-utils";
import { PersonAvatar } from "@/lib/avatar";
import {
  brl,
  FORMA_PAGAMENTO_LABEL,
  STATUS_PAGAMENTO_COLOR,
  STATUS_PAGAMENTO_LABEL,
  valorBruto,
  valorLiquido,
} from "@/lib/financeiro-utils";

export type ParcelasResumo = { total: number; pagas: number };

type Props = {
  rows: any[];
  isLoading: boolean;
  isAdmin: boolean;
  parcelasPorLancamento: Map<string, ParcelasResumo>;
  onRegistrarPagamento: (row: any) => void;
  onParcelar: (row: any) => void;
  onHistorico: (id: string) => void;
  onCancelar: (id: string) => void;
  onReabrir: (row: any) => void;
};

const dataLabel = (iso?: string | null) =>
  iso
    ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : "—";

/** Lista de lançamentos do Financeiro, com badge de status, indicador de parcelas e menu de ações (ADMIN). */
export function TabelaLancamentos({
  rows,
  isLoading,
  isAdmin,
  parcelasPorLancamento,
  onRegistrarPagamento,
  onParcelar,
  onHistorico,
  onCancelar,
  onReabrir,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          {rows.length} lançamento{rows.length === 1 ? "" : "s"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-base font-medium">Nenhum lançamento</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Consultas aprovadas geram automaticamente um lançamento em aberto.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r: any) => {
              const bruto = valorBruto(r);
              const liquido = valorLiquido(r);
              const temAjuste = liquido !== bruto;
              const parcelas = parcelasPorLancamento.get(r.id);
              const podeReceber =
                r.status_pagamento === "ABERTO" || r.status_pagamento === "PARCIAL";
              const podeReabrir =
                r.status_pagamento === "PAGO" || r.status_pagamento === "CANCELADO";

              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant md:flex-row md:items-center"
                >
                  <div className="flex w-full items-center gap-3 md:w-auto">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {brl(liquido)}
                        {temAjuste && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground line-through">
                            {brl(bruto)}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.forma_pagamento
                          ? (FORMA_PAGAMENTO_LABEL[r.forma_pagamento] ?? r.forma_pagamento)
                          : "Forma não definida"}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <PersonAvatar
                          size="xs"
                          nome={r.paciente?.nome}
                          fotoUrl={r.paciente?.foto_url}
                        />
                        {r.paciente?.nome ?? "Sem paciente"}
                      </span>
                      <Badge
                        variant="outline"
                        className={STATUS_PAGAMENTO_COLOR[r.status_pagamento]}
                      >
                        {STATUS_PAGAMENTO_LABEL[r.status_pagamento] ?? r.status_pagamento}
                      </Badge>
                      {parcelas && parcelas.total > 0 && (
                        <Badge variant="outline" className="gap-1 text-[11px]">
                          <Layers className="h-3 w-3" /> {parcelas.pagas}/{parcelas.total} parcelas
                        </Badge>
                      )}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" />
                        {r.profissional?.nome ?? "—"}
                        {r.profissional?.especialidade?.nome
                          ? ` • ${r.profissional.especialidade.nome}`
                          : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Consulta: {dataLabel(r.agendamento?.data)}
                        {r.agendamento?.hora_inicio
                          ? ` • ${fmtHora(r.agendamento.hora_inicio)}`
                          : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pagamento:{" "}
                        {r.pago_em ? new Date(r.pago_em).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </p>
                  </div>

                  <div className="flex w-full items-center justify-end gap-2 md:w-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => onHistorico(r.id)}
                    >
                      <History className="h-3.5 w-3.5" /> Histórico
                    </Button>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {podeReceber && (
                            <DropdownMenuItem onClick={() => onRegistrarPagamento(r)}>
                              <DollarSign className="mr-2 h-4 w-4" /> Registrar pagamento
                            </DropdownMenuItem>
                          )}
                          {podeReceber && (!parcelas || parcelas.total === 0) && (
                            <DropdownMenuItem onClick={() => onParcelar(r)}>
                              <Layers className="mr-2 h-4 w-4" /> Parcelar
                            </DropdownMenuItem>
                          )}
                          {podeReabrir && (
                            <DropdownMenuItem onClick={() => onReabrir(r)}>
                              <History className="mr-2 h-4 w-4" /> Reabrir
                            </DropdownMenuItem>
                          )}
                          {podeReceber && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => onCancelar(r.id)}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Cancelar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
