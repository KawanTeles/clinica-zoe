import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarLogsEntrega } from "@/lib/whatsapp-templates.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity } from "lucide-react";

const STEPS = [
  { key: "accepted_at", label: "accepted" },
  { key: "sent_at", label: "sent" },
  { key: "delivered_at", label: "delivered" },
  { key: "read_at", label: "read" },
] as const;

function fmt(v?: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR") : null;
}

export function EntregaLogsTab() {
  const fn = useServerFn(listarLogsEntrega);
  const [search, setSearch] = useState("");

  const logsQuery = useQuery({
    queryKey: ["wa", "delivery-logs", search],
    queryFn: () => fn({ data: { limit: 100, search: search || undefined } }),
    refetchInterval: 20_000,
  });

  const logs = (logsQuery.data ?? []) as any[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" /> Ciclo de vida das mensagens
        </CardTitle>
        <CardDescription>
          accepted → sent → delivered → read, com wamid, conversation id, código de erro da Meta, payload enviado e JSON
          bruto do webhook. Nada é ocultado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por telefone, paciente ou wamid..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {logsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando logs...
          </div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum log registrado.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((l) => {
              const falhou = !!l.failed_at || l.status_envio === "ERRO";
              return (
                <div key={l.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={falhou ? "destructive" : l.delivered_at ? "default" : "secondary"}>
                      {l.message_status ?? l.status_envio}
                    </Badge>
                    <span className="font-medium">{l.destinatario_telefone}</span>
                    {l.evento ? <Badge variant="outline">{l.evento}</Badge> : null}
                    {l.template_name && l.template_name !== "text" ? (
                      <Badge variant="outline">{l.template_name}</Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")} · {l.duracao_ms ?? 0}ms
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {STEPS.map((s) => {
                      const at = fmt(l[s.key]);
                      return (
                        <span
                          key={s.key}
                          className={`rounded px-2 py-1 ${at ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          {s.label}
                          {at ? `: ${at}` : ""}
                        </span>
                      );
                    })}
                    {l.failed_at ? (
                      <span className="rounded bg-destructive/10 px-2 py-1 text-destructive">
                        failed: {fmt(l.failed_at)}
                      </span>
                    ) : null}
                  </div>

                  {l.mensagem_recebida ? (
                    <p className="mt-2 text-sm">
                      <strong>Recebido:</strong> {l.mensagem_recebida}
                    </p>
                  ) : null}

                  {falhou ? (
                    <p className="mt-2 text-sm text-destructive">
                      {l.erro_codigo ? `Código Meta ${l.erro_codigo}: ` : ""}
                      {l.erro_detalhe ?? l.ultimo_erro}
                    </p>
                  ) : null}

                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <span className="break-all">wamid: {l.wamid ?? "—"}</span>
                    <span className="break-all">conversation: {l.conversation_id ?? "—"}</span>
                  </div>

                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">Payload e JSON bruto</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">
                      {JSON.stringify({ payload: l.payload, webhook: l.webhook_payload }, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
