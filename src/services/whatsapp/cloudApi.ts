/**
 * Meta WhatsApp Cloud API - Cloud API Service
 * Centralized low-level communication with Meta Graph API (v20.0).
 * Server-only module.
 */

export interface WhatsAppConfig {
  access_token: string;
  phone_number_id: string;
  business_account_id: string;
  app_id: string;
  app_secret: string;
  verify_token: string;
  graph_version: string;
}

export interface CloudApiSendResult {
  ok: boolean;
  wamid?: string;
  duracaoMs: number;
  status: number;
  error?: string;
  raw?: any;
}

const digits = (v: string) => v.replace(/\D/g, "");

/**
 * Loads WhatsApp configuration securely from environment variables or DB fallback.
 * Priority: DB `whatsapp_meta_config` if explicitly updated -> Environment Variables -> Default Fallback.
 * NO CREDENTIALS ARE EVER HARDCODED.
 */
export async function loadWhatsAppConfig(): Promise<WhatsAppConfig> {
  const envAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || "1195808793624174";
  const envWabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.META_BUSINESS_ACCOUNT_ID || "1437167158458583";
  const envAppId = process.env.META_APP_ID || "1704752450597676";
  const envAppSecret = process.env.META_APP_SECRET || "";
  const envVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || "clinica_zoe_verify_token_2026";

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dbConfig } = await (supabaseAdmin as any)
      .from("whatsapp_meta_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbConfig?.access_token && dbConfig?.phone_number_id) {
      return {
        access_token: dbConfig.access_token,
        phone_number_id: dbConfig.phone_number_id,
        business_account_id: dbConfig.business_account_id || envWabaId,
        app_id: dbConfig.app_id || envAppId,
        app_secret: dbConfig.app_secret || envAppSecret,
        verify_token: dbConfig.verify_token || envVerifyToken,
        graph_version: dbConfig.graph_version || "v20.0",
      };
    }
  } catch (e) {
    console.warn("[whatsapp:cloudApi] Erro ao carregar whatsapp_meta_config do banco, usando env vars:", e);
  }

  return {
    access_token: envAccessToken,
    phone_number_id: envPhoneId,
    business_account_id: envWabaId,
    app_id: envAppId,
    app_secret: envAppSecret,
    verify_token: envVerifyToken,
    graph_version: "v20.0",
  };
}

/**
 * Sends raw message payload to Meta WhatsApp Cloud API via Graph API.
 */
export async function sendRawCloudApiMessage(
  recipientTo: string,
  bodyPayload: Record<string, any>,
  options?: { agendamentoId?: string; templateName?: string }
): Promise<CloudApiSendResult> {
  const config = await loadWhatsAppConfig();
  const startTime = Date.now();

  if (!config.access_token || !config.phone_number_id) {
    const err = "Credenciais do WhatsApp Cloud API não configuradas (Access Token / Phone Number ID ausentes)";
    console.error(`[whatsapp:cloudApi] ${err}`);
    return { ok: false, duracaoMs: 0, status: 400, error: err };
  }

  const cleanPhone = digits(recipientTo);
  const version = config.graph_version || "v20.0";
  const url = `https://graph.facebook.com/${version}/${config.phone_number_id}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    ...bodyPayload,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const duracaoMs = Date.now() - startTime;
    const raw = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = raw?.error?.message || `Erro HTTP ${response.status}: ${response.statusText}`;
      console.error(`[whatsapp:cloudApi] Falha no envio para ${cleanPhone}:`, errorMsg);
      await logMessageToDb({
        agendamentoId: options?.agendamentoId,
        destinatarioTelefone: cleanPhone,
        mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
        templateName: options?.templateName,
        statusEnvio: "ERRO",
        duracaoMs,
        ultimoErro: errorMsg,
        payload,
      });
      return { ok: false, duracaoMs, status: response.status, error: errorMsg, raw };
    }

    const wamid = raw?.messages?.[0]?.id ?? undefined;
    console.log(`[whatsapp:cloudApi] Sucesso no envio para ${cleanPhone} (wamid: ${wamid}) em ${duracaoMs}ms`);

    await logMessageToDb({
      agendamentoId: options?.agendamentoId,
      destinatarioTelefone: cleanPhone,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      statusEnvio: "ENVIADA",
      wamid,
      duracaoMs,
      payload,
    });

    return { ok: true, wamid, duracaoMs, status: response.status, raw };
  } catch (e) {
    const duracaoMs = Date.now() - startTime;
    const errorMsg = (e as Error).message;
    console.error(`[whatsapp:cloudApi] Exceção ao enviar mensagem para ${cleanPhone}:`, errorMsg);

    await logMessageToDb({
      agendamentoId: options?.agendamentoId,
      destinatarioTelefone: cleanPhone,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      statusEnvio: "ERRO",
      duracaoMs,
      ultimoErro: errorMsg,
      payload,
    });

    return { ok: false, duracaoMs, status: 500, error: errorMsg };
  }
}

/**
 * Internal helper to record WhatsApp message execution log into DB.
 */
async function logMessageToDb(data: {
  agendamentoId?: string;
  destinatarioTelefone: string;
  mensagem: string;
  templateName?: string;
  statusEnvio: string;
  wamid?: string;
  duracaoMs: number;
  ultimoErro?: string;
  payload?: any;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("whatsapp_message_logs").insert({
      agendamento_id: data.agendamentoId || null,
      destinatario_telefone: data.destinatarioTelefone,
      mensagem: data.mensagem,
      template_name: data.templateName || "text",
      status_envio: data.statusEnvio,
      wamid: data.wamid || null,
      duracao_ms: data.duracaoMs,
      ultimo_erro: data.ultimoErro || null,
      payload: data.payload || null,
    });
  } catch (err) {
    console.warn("[whatsapp:cloudApi] Erro ao registrar log no banco:", err);
  }
}
