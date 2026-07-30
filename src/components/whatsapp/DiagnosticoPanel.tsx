import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { diagnosticarWhatsApp } from "@/lib/whatsapp-templates.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function DiagnosticoPanel() {
  const fn = useServerFn(diagnosticarWhatsApp);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    try {
      setLoading(true);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const r = await fn({ data: { origin } });
      setResult(r);
      if (r.ok) toast.success("Todos os itens do diagnóstico passaram.");
      else toast.warning("Diagnóstico concluído com pendências — veja o relatório.", { duration: 8000 });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao executar o diagnóstico.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" /> Diagnosticar WhatsApp
          </CardTitle>
          <CardDescription>
            Valida token, Phone Number ID, WABA, Graph API, templates, webhook, assinatura, Allowed List e janela de
            conversa.
          </CardDescription>
        </div>
        <Button onClick={run} disabled={loading} className="shrink-0 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          Executar diagnóstico
        </Button>
      </CardHeader>
      <CardContent>
        {!result ? (
          <p className="text-sm text-muted-foreground">
            Nenhum diagnóstico executado nesta sessão.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant={result.ok ? "default" : "destructive"}>
                {result.ok ? "Integração saudável" : "Pendências encontradas"}
              </Badge>
              <span>
                {result.itens.filter((i: any) => i.ok).length}/{result.itens.length} verificações OK ·{" "}
                {result.duracaoMs}ms
              </span>
            </div>

            {result.itens.map((item: any) => (
              <div key={item.chave} className="flex gap-3 rounded-lg border p-3">
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <div className="font-medium">{item.titulo}</div>
                  <div className="break-words text-sm text-muted-foreground">{item.detalhe}</div>
                </div>
              </div>
            ))}

            <details className="rounded-lg border p-3 text-xs">
              <summary className="cursor-pointer font-medium">JSON bruto do diagnóstico</summary>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
