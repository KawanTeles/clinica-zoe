import type { MetaCloudConfig, MetaSendMessagePayload } from "@/lib/types/meta";

const digits = (v: string) => v.replace(/\D/g, "");

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
 */
export async function sendMetaMessage(
  config: MetaCloudConfig,
  payload: MetaSendMessagePayload,
): Promise<MetaSendResult> {
  const version = config.graph_version || "v20.0";
  const baseUrl = `https://graph.facebook.com/${version}`;
  const phoneId = config.phone_number_id;

  if (!config.access_token || !phoneId) {
    return {
      ok: false,
      duracaoMs: 0,
      status: 400,
      error: "Access Token ou Phone Number ID não configurados",
    };
  }

  const start = Date.now();
  const recipientPhone = digits(payload.to);

  let bodyData: Record<string, any>;

  if (payload.type === "template" && payload.templateName) {
    bodyData = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: payload.templateName,
        language: { code: payload.templateLanguage || "pt_BR" },
        components: payload.components || [],
      },
    };
  } else {
    bodyData = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "text",
      text: {
        preview_url: true,
        body: payload.text || "",
      },
    };
  }

  try {
    const resp = await fetch(`${baseUrl}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

    const duracaoMs = Date.now() - start;
    const raw = await resp.json().catch(() => null);

    if (!resp.ok) {
      return {
        ok: false,
        duracaoMs,
        status: resp.status,
        error: raw?.error?.message ?? `Erro HTTP ${resp.status}`,
        raw,
      };
    }

    const wamid = raw?.messages?.[0]?.id ?? undefined;

    return {
      ok: true,
      wamid,
      duracaoMs,
      status: resp.status,
      raw,
    };
  } catch (e) {
    return {
      ok: false,
      duracaoMs: Date.now() - start,
      status: 500,
      error: (e as Error).message,
    };
  }
}
