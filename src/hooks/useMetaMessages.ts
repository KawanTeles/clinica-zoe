import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { sendMetaTestMessage, getMetaMetrics, getMetaLogs } from "@/lib/meta.functions";
import { META_KEYS } from "@/hooks/useMetaStatus";

export function useMetaMessages(search?: string) {
  const qc = useQueryClient();
  const fnSend = useServerFn(sendMetaTestMessage);
  const fnMetrics = useServerFn(getMetaMetrics);
  const fnLogs = useServerFn(getMetaLogs);

  const metricsQuery = useQuery({
    queryKey: META_KEYS.metrics,
    queryFn: () => fnMetrics({ data: undefined as any }),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const logsQuery = useQuery({
    queryKey: META_KEYS.logs(search),
    queryFn: () => fnLogs({ data: { limit: 100, search } }),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const sendMutation = useMutation({
    mutationFn: (vars: { to: string; message: string }) => fnSend({ data: vars }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Mensagem enviada com sucesso via Meta Cloud API!");
        qc.invalidateQueries({ queryKey: META_KEYS.metrics });
        qc.invalidateQueries({ queryKey: META_KEYS.logs("") });
      } else {
        toast.error(`Falha no envio: ${res.error}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    sendTestMessage: sendMutation.mutate,
    isSending: sendMutation.isPending,
    sendResult: sendMutation.data,
    metrics: metricsQuery.data,
    isLoadingMetrics: metricsQuery.isLoading,
    logs: logsQuery.data ?? [],
    isLoadingLogs: logsQuery.isLoading,
  };
}
