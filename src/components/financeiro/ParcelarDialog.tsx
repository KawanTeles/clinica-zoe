import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, Loader2 } from "lucide-react";
import { brl } from "@/lib/financeiro-utils";

type Parcela = { numero: number; valor: string; vencimento: string };

function addDays(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function gerarParcelas(
  qtd: number,
  valorTotal: number,
  primeiroVencimento: string,
  intervaloDias: number,
): Parcela[] {
  const base = Math.floor((valorTotal / qtd) * 100) / 100;
  const resto = Math.round((valorTotal - base * qtd) * 100) / 100;
  return Array.from({ length: qtd }, (_, i) => ({
    numero: i + 1,
    valor: (i === qtd - 1 ? base + resto : base).toFixed(2),
    vencimento: addDays(primeiroVencimento, intervaloDias * i),
  }));
}

/** Define o parcelamento de um lançamento (financeiro_parcelas) — o pai decide qual `financeiroId` está aberto. */
export function ParcelarDialog({
  financeiroId,
  valorTotal,
  onOpenChange,
}: {
  financeiroId: string | null;
  valorTotal: number;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const open = !!financeiroId;

  const [qtd, setQtd] = useState(2);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [intervaloDias, setIntervaloDias] = useState(30);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  useEffect(() => {
    if (open) {
      setParcelas(gerarParcelas(qtd, valorTotal, primeiroVencimento, intervaloDias));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const regerar = (novaQtd: number, novoVencimento: string, novoIntervalo: number) => {
    setQtd(novaQtd);
    setPrimeiroVencimento(novoVencimento);
    setIntervaloDias(novoIntervalo);
    setParcelas(gerarParcelas(novaQtd, valorTotal, novoVencimento, novoIntervalo));
  };

  const somaParcelas = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.valor.replace(",", ".")) || 0), 0),
    [parcelas],
  );
  const diferenca = Math.round((valorTotal - somaParcelas) * 100) / 100;

  const mut = useMutation({
    mutationFn: async () => {
      if (!financeiroId) return;
      if (diferenca !== 0) {
        throw new Error(
          `A soma das parcelas precisa fechar com o valor total (diferença: ${brl(diferenca)}).`,
        );
      }
      const { error } = await supabase.from("financeiro_parcelas").insert(
        parcelas.map((p) => ({
          financeiro_id: financeiroId,
          numero: p.numero,
          valor: Number(p.valor.replace(",", ".")),
          vencimento: p.vencimento,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcelamento definido");
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["financeiro-parcelas", financeiroId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao parcelar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Parcelar lançamento
          </DialogTitle>
          <DialogDescription>
            Total a parcelar: <strong>{brl(valorTotal)}</strong>. Ajuste valores e vencimentos
            individualmente se precisar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Nº de parcelas</Label>
            <Input
              type="number"
              min={2}
              max={24}
              value={qtd}
              onChange={(e) =>
                regerar(Math.max(2, Number(e.target.value) || 2), primeiroVencimento, intervaloDias)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>1º vencimento</Label>
            <Input
              type="date"
              value={primeiroVencimento}
              onChange={(e) => regerar(qtd, e.target.value, intervaloDias)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Intervalo (dias)</Label>
            <Input
              type="number"
              min={1}
              value={intervaloDias}
              onChange={(e) =>
                regerar(qtd, primeiroVencimento, Math.max(1, Number(e.target.value) || 30))
              }
            />
          </div>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {parcelas.map((p, i) => (
            <div
              key={p.numero}
              className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 rounded-lg border border-border bg-card p-2"
            >
              <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-xs font-semibold">
                {p.numero}
              </span>
              <Input
                type="number"
                step="0.01"
                value={p.valor}
                onChange={(e) => {
                  const next = [...parcelas];
                  next[i] = { ...p, valor: e.target.value };
                  setParcelas(next);
                }}
              />
              <Input
                type="date"
                value={p.vencimento}
                onChange={(e) => {
                  const next = [...parcelas];
                  next[i] = { ...p, vencimento: e.target.value };
                  setParcelas(next);
                }}
              />
            </div>
          ))}
        </div>

        {diferenca !== 0 && (
          <p className="text-xs text-destructive">
            A soma das parcelas ({brl(somaParcelas)}) difere do total em {brl(diferenca)}.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || diferenca !== 0}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            parcelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
