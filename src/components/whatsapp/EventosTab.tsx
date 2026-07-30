import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listarTemplates,
  listarEventosTemplates,
  salvarEventoTemplate,
} from "@/lib/whatsapp-templates.functions";
import { TEMPLATE_KEYS } from "./TemplatesTab";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Workflow } from "lucide-react";

const LABELS: Record<string, string> = {
  SOLICITACAO_NOVA: "Novo agendamento (solicitação)",
  CONSULTA_APROVADA: "Consulta aprovada",
  CONSULTA_RECUSADA: "Consulta recusada",
  CONSULTA_CANCELADA: "Consulta cancelada",
  CONSULTA_REMARCADA: "Consulta remarcada",
  LEMBRETE_24H: "Lembrete 24h antes",
  LEMBRETE_2H: "Lembrete 2h antes",
  PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
  PAGAMENTO_PENDENTE: "Pagamento pendente",
  CONSULTA_FINALIZADA: "Consulta finalizada",
};

export function EventosTab() {
  const qc = useQueryClient();
  const fnEventos = useServerFn(listarEventosTemplates);
  const fnTemplates = useServerFn(listarTemplates);
  const fnSalvar = useServerFn(salvarEventoTemplate);

  const eventosQuery = useQuery({
    queryKey: TEMPLATE_KEYS.eventos,
    queryFn: () => fnEventos({ data: undefined }),
  });
  const templatesQuery = useQuery({
    queryKey: TEMPLATE_KEYS.templates,
    queryFn: () => fnTemplates({ data: undefined }),
  });

  const salvar = useMutation({
    mutationFn: (v: { evento: string; template_name: string | null; language?: string }) => fnSalvar({ data: v }),
    onSuccess: () => {
      toast.success("Mapeamento atualizado.");
      qc.invalidateQueries({ queryKey: TEMPLATE_KEYS.eventos });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eventos = (eventosQuery.data ?? []) as any[];
  const aprovados = ((templatesQuery.data ?? []) as any[]).filter((t) => t.status === "APPROVED");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" /> Eventos do sistema
        </CardTitle>
        <CardDescription>
          Defina qual template aprovado é disparado em cada evento. Dentro da janela de 24h a mensagem é enviada como
          texto livre; fora dela, o template selecionado aqui é utilizado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {eventosQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos...
          </div>
        ) : (
          <div className="space-y-3">
            {eventos.map((ev) => (
              <div
                key={ev.evento}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{LABELS[ev.evento] ?? ev.evento}</div>
                  <div className="text-xs text-muted-foreground">
                    Variáveis: {Array.isArray(ev.variaveis) && ev.variaveis.length ? ev.variaveis.join(", ") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ev.template_name ? (
                    <Badge variant="default">Configurado</Badge>
                  ) : (
                    <Badge variant="secondary">Sem template</Badge>
                  )}
                  <Select
                    value={ev.template_name ?? "__none__"}
                    onValueChange={(v) =>
                      salvar.mutate({
                        evento: ev.evento,
                        template_name: v === "__none__" ? null : v,
                        language: aprovados.find((t) => t.name === v)?.language ?? "pt_BR",
                      })
                    }
                  >
                    <SelectTrigger className="w-[260px]">
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {aprovados.map((t) => (
                        <SelectItem key={`${t.name}-${t.language}`} value={t.name}>
                          {t.name} ({t.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {aprovados.length === 0 ? (
              <p className="text-sm text-destructive">
                Nenhum template APPROVED disponível. Crie e aprove templates na aba “Templates” antes de mapear os
                eventos.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
