import type { MetaCloudConfig, MetaSendMessagePayload } from "@/lib/types/meta";
import { sendRawCloudApiMessage } from "@/services/whatsapp/cloudApi";

export interface MetaSendResult {
  ok: boolean;
  wamid?: string;
  duracaoMs: number;
  status: number;
  error?: string;
  raw?: any;
}

/**
 * Service de Envio de Mensagens via Meta WhatsApp Cloud API
 * Redireciona para o serviço centralizado @/services/whatsapp
 */
export async function sendMetaMessage(
  _config: MetaCloudConfig,
  payload: MetaSendMessagePayload,
): Promise<MetaSendResult> {
  const bodyPayload: Record<string, any> = payload.type === "template" && payload.templateName
    ? {
        type: "template",
        template: {
          name: payload.templateName,
          language: { code: payload.templateLanguage || "pt_BR" },
          components: payload.components || [],
        },
      }
    : {
        type: "text",
        text: {
          preview_url: true,
          body: payload.text || "",
        },
      };

  return sendRawCloudApiMessage(payload.to, bodyPayload, {
    templateName: payload.templateName,
  });
}
