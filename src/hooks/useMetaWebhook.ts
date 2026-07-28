import { useQuery } from "@tanstack/react-query";
import { useMetaStatus } from "@/hooks/useMetaStatus";

export function useMetaWebhook() {
  const { status, config, isLoadingStatus } = useMetaStatus();

  const isConfigured = Boolean(config?.access_token && config?.phone_number_id);
  const isValid = Boolean(status?.online && status?.webhookConnected);

  return {
    isConfigured,
    isValid,
    isLoading: isLoadingStatus,
    verifyToken: config?.verify_token || "clinica_zoe_verify_token_2026",
    statusText: isValid
      ? "Webhook Ativo e Conectado"
      : isConfigured
        ? "Webhook Pendente de Validação"
        : "Webhook Inexistente",
  };
}
