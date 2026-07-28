import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { fetchMetaTemplatesList, sendMetaTemplateTest } from "@/lib/meta.functions";
import { META_KEYS } from "@/hooks/useMetaStatus";

export function useMetaTemplates() {
  const qc = useQueryClient();
  const fnTemplates = useServerFn(fetchMetaTemplatesList);
  const fnSendTemplate = useServerFn(sendMetaTemplateTest);

  const templatesQuery = useQuery({
    queryKey: META_KEYS.templates,
    queryFn: () => fnTemplates({ data: undefined as any }),
    staleTime: 30_000,
  });

  const sendTemplateMutation = useMutation({
    mutationFn: (vars: { to: string; templateName: string; language?: string }) =>
      fnSendTemplate({ data: vars }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Template oficial enviado com sucesso!");
        qc.invalidateQueries({ queryKey: META_KEYS.metrics });
        qc.invalidateQueries({ queryKey: META_KEYS.logs("") });
      } else {
        toast.error(`Falha no envio do template: ${res.error}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    templates: templatesQuery.data ?? [],
    isLoadingTemplates: templatesQuery.isLoading,
    refetchTemplates: templatesQuery.refetch,
    sendTemplateTest: sendTemplateMutation.mutate,
    isSendingTemplate: sendTemplateMutation.isPending,
    sendTemplateResult: sendTemplateMutation.data,
  };
}
