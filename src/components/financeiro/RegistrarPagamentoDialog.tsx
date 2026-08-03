import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, Paperclip } from "lucide-react";
import { brl, FORMA_PAGAMENTO_LABEL, valorLiquido } from "@/lib/financeiro-utils";

export type LancamentoParaPagamento = {
  id: string;
  valor: number;
  desconto: number;
  juros: number;
  multa: number;
  agendamento?: { valor: number | null } | null;
};

const schema = z.object({
  valor_pago: z.number().positive("Informe um valor maior que zero"),
  forma_pagamento: z.enum(["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "OUTRO"]),
  pago_em: z.string().min(1),
  observacoes: z.string().optional(),
});

const ANEXO_MAX_BYTES = 10 * 1024 * 1024;
const ANEXO_ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Registra uma baixa (pagamento total/parcial) em financeiro_pagamentos — nunca faz UPDATE direto de status_pagamento. */
export function RegistrarPagamentoDialog({
  item,
  onOpenChange,
}: {
  item: LancamentoParaPagamento | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const open = !!item;
  const fileRef = useRef<HTMLInputElement>(null);

  const [desconto, setDesconto] = useState("0");
  const [juros, setJuros] = useState("0");
  const [multa, setMulta] = useState("0");
  const [valorPago, setValorPago] = useState("");
  const [forma, setForma] = useState<string>("PIX");
  const [pagoEm, setPagoEm] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const { data: jaPago } = useQuery({
    queryKey: ["financeiro-saldo", item?.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_pagamentos")
        .select("valor_pago")
        .eq("financeiro_id", item!.id)
        .eq("estornado", false);
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.valor_pago), 0);
    },
  });

  useEffect(() => {
    if (!item) return;
    setDesconto(String(item.desconto ?? 0));
    setJuros(String(item.juros ?? 0));
    setMulta(String(item.multa ?? 0));
    setForma("PIX");
    setPagoEm(new Date().toISOString().slice(0, 10));
    setObservacoes("");
    setArquivo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const devido = item
    ? valorLiquido({
        ...item,
        desconto: Number(desconto) || 0,
        juros: Number(juros) || 0,
        multa: Number(multa) || 0,
      })
    : 0;
  const saldo = Math.max(0, Math.round((devido - (jaPago ?? 0)) * 100) / 100);

  useEffect(() => {
    if (open) setValorPago(saldo > 0 ? saldo.toFixed(2) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jaPago, desconto, juros, multa]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!item) return;
      const parsed = schema.parse({
        valor_pago: Number(valorPago.replace(",", ".")),
        forma_pagamento: forma,
        pago_em: pagoEm,
        observacoes: observacoes || undefined,
      });

      const ajustesMudaram =
        Number(desconto) !== item.desconto ||
        Number(juros) !== item.juros ||
        Number(multa) !== item.multa;
      if (ajustesMudaram) {
        const { error: updErr } = await supabase
          .from("financeiro")
          .update({
            desconto: Number(desconto) || 0,
            juros: Number(juros) || 0,
            multa: Number(multa) || 0,
          })
          .eq("id", item.id);
        if (updErr) throw updErr;
      }

      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("financeiro_pagamentos").insert({
        financeiro_id: item.id,
        valor_pago: parsed.valor_pago,
        forma_pagamento: parsed.forma_pagamento as any,
        pago_em: `${parsed.pago_em}T${new Date().toTimeString().slice(0, 8)}`,
        observacoes: parsed.observacoes ?? null,
        registrado_por: auth.user?.id,
      });
      if (error) throw error;

      if (arquivo) {
        const path = `${item.id}/${crypto.randomUUID()}-${arquivo.name}`;
        const { error: upErr } = await supabase.storage.from("financeiro").upload(path, arquivo, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { error: anexoErr } = await supabase.from("financeiro_anexos").insert({
          financeiro_id: item.id,
          arquivo_path: `financeiro/${path}`,
          nome_arquivo: arquivo.name,
          enviado_por: auth.user?.id,
        });
        if (anexoErr) throw anexoErr;
      }
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["financeiro-pagamentos", item?.id] });
      qc.invalidateQueries({ queryKey: ["financeiro-anexos", item?.id] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) toast.error(e.issues[0].message);
      else toast.error(e?.message ?? "Falha ao registrar pagamento");
    },
  });

  const pickFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!ANEXO_ACCEPT.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG, WEBP ou PDF.");
      return;
    }
    if (file.size > ANEXO_MAX_BYTES) {
      toast.error("Arquivo muito grande. O limite é 10 MB.");
      return;
    }
    setArquivo(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Registrar pagamento
          </DialogTitle>
          <DialogDescription>
            Saldo devedor atual: <strong>{brl(saldo)}</strong>
            {(jaPago ?? 0) > 0 && <> — já recebido: {brl(jaPago ?? 0)}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Valor pago (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FORMA_PAGAMENTO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data do pagamento</Label>
            <Input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Anexo (opcional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              {arquivo ? arquivo.name : "Anexar comprovante"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Desconto (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Juros (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={juros}
              onChange={(e) => setJuros(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Multa (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={multa}
              onChange={(e) => setMulta(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
