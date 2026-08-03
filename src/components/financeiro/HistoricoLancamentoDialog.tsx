import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, History, Loader2, Paperclip, RotateCcw } from "lucide-react";
import { brl, FORMA_PAGAMENTO_LABEL } from "@/lib/financeiro-utils";

const ACAO_LABEL: Record<string, string> = {
  BAIXA_REGISTRADA: "Pagamento registrado",
  BAIXA_ESTORNADA: "Pagamento estornado",
  CANCELADO: "Lançamento cancelado",
  REABERTO: "Lançamento reaberto",
  EDITADO: "Valores editados",
  STATUS_ALTERADO: "Status alterado",
};

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/** Timeline de pagamentos (com estorno) + auditoria de um lançamento — o pai decide qual `financeiroId` está aberto. */
export function HistoricoLancamentoDialog({
  financeiroId,
  onOpenChange,
  isAdmin,
}: {
  financeiroId: string | null;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const open = !!financeiroId;

  const { data: pagamentos, isLoading: loadingPagamentos } = useQuery({
    queryKey: ["financeiro-pagamentos", financeiroId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagamentos")
        .select(
          "id, valor_pago, forma_pagamento, pago_em, observacoes, estornado, estornado_em, registrado_por",
        )
        .eq("financeiro_id", financeiroId as string)
        .order("pago_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: anexos } = useQuery({
    queryKey: ["financeiro-anexos", financeiroId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_anexos")
        .select("id, arquivo_path, nome_arquivo, created_at")
        .eq("financeiro_id", financeiroId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: auditoria, isLoading: loadingAuditoria } = useQuery({
    queryKey: ["financeiro-auditoria", financeiroId],
    enabled: open && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_auditoria")
        .select("id, acao, actor_nome, valor_anterior, valor_novo, created_at")
        .eq("financeiro_id", financeiroId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const estornar = useMutation({
    mutationFn: async (pagamentoId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("financeiro_pagamentos")
        .update({
          estornado: true,
          estornado_em: new Date().toISOString(),
          estornado_por: auth.user?.id ?? null,
        })
        .eq("id", pagamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento estornado");
      qc.invalidateQueries({ queryKey: ["financeiro-pagamentos", financeiroId] });
      qc.invalidateQueries({ queryKey: ["financeiro-auditoria", financeiroId] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao estornar"),
  });

  const openAnexo = async (path: string) => {
    const [bucket, ...rest] = path.split("/");
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o anexo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico do lançamento
          </DialogTitle>
          <DialogDescription>
            Pagamentos registrados, estornos, anexos e alterações.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pagamentos
            </h3>
            {loadingPagamentos ? (
              <div className="grid place-items-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : !pagamentos?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {pagamentos.map((p: any) => (
                  <div
                    key={p.id}
                    className={`flex items-start justify-between rounded-lg border px-3 py-2 text-sm ${
                      p.estornado
                        ? "border-border/60 bg-muted/30 text-muted-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {brl(p.valor_pago)}
                        {p.estornado && (
                          <Badge variant="outline" className="text-[10px]">
                            Estornado
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs">
                        {FORMA_PAGAMENTO_LABEL[p.forma_pagamento] ?? p.forma_pagamento} •{" "}
                        {fmt(p.pago_em)}
                      </p>
                      {p.observacoes && <p className="mt-1 text-xs italic">"{p.observacoes}"</p>}
                    </div>
                    {isAdmin && !p.estornado && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => estornar.mutate(p.id)}
                        disabled={estornar.isPending}
                      >
                        <RotateCcw className="h-3 w-3" /> Estornar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {!!anexos?.length && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anexos
              </h3>
              <div className="space-y-1.5">
                {anexos.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => openAnexo(a.arquivo_path)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-secondary/40"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.nome_arquivo}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isAdmin && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Auditoria
              </h3>
              {loadingAuditoria ? (
                <div className="grid place-items-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ) : !auditoria?.length ? (
                <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
              ) : (
                <div className="space-y-2">
                  {auditoria.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {ACAO_LABEL[a.acao] ?? a.acao}
                        </p>
                        <p className="text-muted-foreground">
                          {a.actor_nome ?? "Sistema"} • {fmt(a.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
