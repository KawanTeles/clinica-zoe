/**
 * Meta WhatsApp Cloud API - Cloud API Service
 * Comunicação de baixo nível com a Meta Graph API (v23.0).
 * Módulo server-only. Implementação OFICIAL e ÚNICA de envio de WhatsApp.
 */

import { validateAndFormatPhone } from "./validator";
import { parseMetaApiError, MetaParsedError } from "./errors";
import { logWhatsAppExecution } from "./logger";
import { executeWithRetry } from "./retry";

/** Versão da Graph API utilizada em toda a integração. */
export const GRAPH_VERSION_DEFAULT = "v23.0";

/** Janela de atendimento (customer service window) da Meta: 24 horas. */
export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WhatsAppConfig {
  access_token: string;
  phone_number_id: string;
  business_account_id: string;
  app_id: string;
  app_secret: string;
  verify_token: string;
  graph_version: string;
  fallback_template: string;
  fallback_template_lang: string;
}

export interface CloudApiSendResult {
  ok: boolean;
  wamid?: string;
  duracaoMs: number;
  status: number;
  error?: string;
  parsedError?: MetaParsedError;
  raw?: any;
  responseHeaders?: Record<string, string>;
  requestPayload?: Record<string, any>;
  messageStatus?: string;
  formattedPhone?: string;
  isDevelopmentMode?: boolean;
  usedTemplate?: string;
}

/**
 * Carrega a configuração do WhatsApp. Nenhuma credencial é hardcoded.
 * Prioridade: Banco (`whatsapp_meta_config`) -> Variáveis de ambiente (`WHATSAPP_*` / `META_*`).
 */
export async function loadWhatsAppConfig(): Promise<WhatsAppConfig> {
  const envAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || "";
  const envWabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.META_BUSINESS_ACCOUNT_ID || "";
  const envAppId = process.env.META_APP_ID || "";
  const envAppSecret = process.env.META_APP_SECRET || "";
  const envVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || "";
  const envTemplate = process.env.WHATSAPP_FALLBACK_TEMPLATE || "";
  const envTemplateLang = process.env.WHATSAPP_FALLBACK_TEMPLATE_LANG || "pt_BR";
  const envVersion = process.env.WHATSAPP_GRAPH_VERSION || GRAPH_VERSION_DEFAULT;

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
        graph_version: dbConfig.graph_version || envVersion,
        fallback_template: envTemplate,
        fallback_template_lang: envTemplateLang,
      };
    }
  } catch (e) {
    console.warn("[whatsapp:cloudApi] Aviso ao ler whatsapp_meta_config, usando variáveis de ambiente:", (e as Error).message);
  }

  return {
    access_token: envAccessToken,
    phone_number_id: envPhoneId,
    business_account_id: envWabaId,
    app_id: envAppId,
    app_secret: envAppSecret,
    verify_token: envVerifyToken,
    graph_version: envVersion,
    fallback_template: envTemplate,
    fallback_template_lang: envTemplateLang,
  };
}

/** Retorna o timestamp da última mensagem recebida do número (janela de 24h). */
export async function lastInboundAt(phoneE164: string): Promise<Date | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("whatsapp_sessions")
      .select("last_inbound_at")
      .eq("telefone", phoneE164)
      .maybeSingle();
    return data?.last_inbound_at ? new Date(data.last_inbound_at) : null;
  } catch {
    return null;
  }
}

/** A janela de atendimento de 24h está aberta para este número? */
export async function isSessionOpen(phoneE164: string): Promise<boolean> {
  const last = await lastInboundAt(phoneE164);
  return !!last && Date.now() - last.getTime() < SESSION_WINDOW_MS;
}

/** Registra (upsert) o recebimento de uma mensagem, abrindo a janela de 24h. */
export async function registerInbound(phoneE164: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    await (supabaseAdmin as any)
      .from("whatsapp_sessions")
      .upsert({ telefone: phoneE164, last_inbound_at: now, updated_at: now }, { onConflict: "telefone" });
  } catch (e) {
    console.warn("[whatsapp:cloudApi] Falha ao registrar janela de sessão:", (e as Error).message);
  }
}

/**
 * Envia mensagem via Meta WhatsApp Cloud API.
 * Registra integralmente: HTTP status, headers, body, JSON, message id e erro completo.
 * Nunca retorna sucesso sem que a Meta responda 200/201 com um wamid válido.
 */
export async function sendRawCloudApiMessage(
  recipientTo: string,
  bodyPayload: Record<string, any>,
  options?: {
    agendamentoId?: string;
    pacienteNome?: string;
    profissionalNome?: string;
    templateName?: string;
    evento?: string;
  }
): Promise<CloudApiSendResult> {
  const config = await loadWhatsAppConfig();
  const startTime = Date.now();

  // 1. Sanitização e validação do número (E.164, sem "+", sem máscara, sem espaços)
  const phoneValidation = validateAndFormatPhone(recipientTo);

  if (!phoneValidation.valid) {
    const validationError = `Telefone de destino inválido '${recipientTo}': ${phoneValidation.error}`;
    console.error(`[whatsapp:cloudApi] ${validationError}`);

    const parsedErr: MetaParsedError = {
      code: "INVALID_PHONE_NUMBER",
      type: "ValidationError",
      userMessage: phoneValidation.error || "Número de telefone em formato inválido.",
      technicalDiagnostic: validationError,
      isDevelopmentModeError: false,
      isAllowedListError: false,
      isTokenExpired: false,
      retryable: false,
    };

    await logWhatsAppExecution({
      evento: options?.evento,
      agendamentoId: options?.agendamentoId,
      pacienteNome: options?.pacienteNome,
      profissionalNome: options?.profissionalNome,
      destinatarioTelefone: recipientTo,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      statusEnvio: "ERRO",
      duracaoMs: Date.now() - startTime,
      ultimoErro: validationError,
      stackTrace: new Error(validationError).stack,
    });

    return {
      ok: false,
      duracaoMs: Date.now() - startTime,
      status: 400,
      error: validationError,
      parsedError: parsedErr,
    };
  }

  const cleanPhone = phoneValidation.formattedPhone;

  // 2. Validação de credenciais
  if (!config.access_token || !config.phone_number_id) {
    const credError =
      "Credenciais do Meta WhatsApp Cloud API ausentes no ambiente atual (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID não configurados).";
    console.error(`[whatsapp:cloudApi] ${credError}`);

    const parsedErr = parseMetaApiError({ error: { message: credError, code: 401 } }, 401);

    await logWhatsAppExecution({
      evento: options?.evento,
      agendamentoId: options?.agendamentoId,
      pacienteNome: options?.pacienteNome,
      profissionalNome: options?.profissionalNome,
      destinatarioTelefone: cleanPhone,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      statusEnvio: "ERRO",
      duracaoMs: Date.now() - startTime,
      ultimoErro: credError,
      actionRequired: "Cadastre WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID nos secrets do projeto.",
    });

    return {
      ok: false,
      duracaoMs: Date.now() - startTime,
      status: 401,
      error: credError,
      parsedError: parsedErr,
      formattedPhone: cleanPhone,
    };
  }

  const version = config.graph_version || GRAPH_VERSION_DEFAULT;
  const url = `https://graph.facebook.com/${version}/${config.phone_number_id}/messages`;

  const finalPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    ...bodyPayload,
  };

  console.log(
    `[whatsapp:cloudApi] Iniciando envio | Número: ${cleanPhone} | Tipo: ${bodyPayload.type} | Template: ${options?.templateName ?? "-"} | Phone Number ID: ${config.phone_number_id} | Endpoint: POST ${url}`
  );
  console.log(`[whatsapp:cloudApi] Payload: ${JSON.stringify(finalPayload)}`);

  let lastHeaders: Record<string, string> = {};

  // 3. Execução com retry exponencial
  const retryResult = await executeWithRetry(async () => {
    const attemptStart = Date.now();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(finalPayload),
      });

      const attemptDur = Date.now() - attemptStart;
      const rawText = await response.text();
      let raw: any = null;
      try {
        raw = rawText ? JSON.parse(rawText) : null;
      } catch {
        raw = { non_json_body: rawText };
      }

      lastHeaders = Object.fromEntries(response.headers.entries());

      console.log(
        `[whatsapp:cloudApi] Resposta HTTP: ${response.status} ${response.statusText} | ${attemptDur}ms | Headers: ${JSON.stringify(lastHeaders)}`
      );
      console.log(`[whatsapp:cloudApi] Resposta JSON: ${rawText}`);

      if (!response.ok) {
        const errorMsg = raw?.error?.message || `Erro HTTP ${response.status}: ${response.statusText}`;
        return { ok: false, status: response.status, raw, error: errorMsg, duracaoMs: attemptDur };
      }

      // Não assumir sucesso: exigir wamid e status diferente de "failed"
      const wamid = raw?.messages?.[0]?.id;
      const msgStatus = raw?.messages?.[0]?.message_status;
      if (!wamid || msgStatus === "failed") {
        return {
          ok: false,
          status: response.status,
          raw,
          error: `A Meta respondeu HTTP ${response.status} sem confirmar o envio (message_status=${msgStatus ?? "ausente"}, wamid=${wamid ?? "ausente"}).`,
          duracaoMs: attemptDur,
        };
      }

      return { ok: true, status: response.status, raw, duracaoMs: attemptDur };
    } catch (e) {
      console.error(`[whatsapp:cloudApi] Falha de rede ao chamar a Meta: ${(e as Error).message}`);
      return { ok: false, status: 500, error: (e as Error).message, duracaoMs: Date.now() - attemptStart };
    }
  }, { maxRetries: 3, initialDelayMs: 500 });

  const totalDuration = Date.now() - startTime;
  const lastRaw = retryResult.data || retryResult.parsedError?.rawError;
  const wamid = lastRaw?.messages?.[0]?.id ?? undefined;
  const messageStatus = lastRaw?.messages?.[0]?.message_status ?? undefined;

  if (retryResult.success) {
    console.log(
      `[whatsapp:cloudApi] Sucesso: ${cleanPhone} | wamid=${wamid} | message_status=${messageStatus} | ${totalDuration}ms | ${retryResult.totalAttempts} tentativa(s).`
    );

    await logWhatsAppExecution({
      evento: options?.evento,
      agendamentoId: options?.agendamentoId,
      pacienteNome: options?.pacienteNome,
      profissionalNome: options?.profissionalNome,
      destinatarioTelefone: cleanPhone,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      payloadEnviado: finalPayload,
      respostaMeta: lastRaw,
      responseHeaders: lastHeaders,
      httpStatus: 200,
      duracaoMs: totalDuration,
      statusEnvio: "ENVIADA",
      messageStatus: messageStatus ?? "accepted",
      conversationId: lastRaw?.messages?.[0]?.conversation?.id ?? lastRaw?.conversation?.id ?? null,
      conversationCategory:
        lastRaw?.messages?.[0]?.conversation?.origin?.type ?? lastRaw?.conversation?.origin?.type ?? null,
      acceptedAt: new Date().toISOString(),
      retryCount: retryResult.totalAttempts - 1,
    });

    return {
      ok: true,
      wamid,
      messageStatus,
      duracaoMs: totalDuration,
      status: 200,
      raw: lastRaw,
      responseHeaders: lastHeaders,
      requestPayload: finalPayload,
      formattedPhone: cleanPhone,
      usedTemplate: options?.templateName,
    };
  }

  const parsedErr = retryResult.parsedError || parseMetaApiError(lastRaw, 500);

  console.error(
    `[whatsapp:cloudApi] Erro no envio para ${cleanPhone} após ${retryResult.totalAttempts} tentativa(s): ${parsedErr.technicalDiagnostic}`
  );

  await logWhatsAppExecution({
    evento: options?.evento,
    agendamentoId: options?.agendamentoId,
    pacienteNome: options?.pacienteNome,
    profissionalNome: options?.profissionalNome,
    destinatarioTelefone: cleanPhone,
    mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
    templateName: options?.templateName,
    payloadEnviado: finalPayload,
    respostaMeta: lastRaw,
    responseHeaders: lastHeaders,
    httpStatus: Number(parsedErr.code) || 500,
    duracaoMs: totalDuration,
    statusEnvio: "ERRO",
    messageStatus: "failed",
    erroCodigo: String(parsedErr.code ?? ""),
    erroDetalhe: parsedErr.technicalDiagnostic,
    failedAt: new Date().toISOString(),
    ultimoErro: parsedErr.technicalDiagnostic,
    retryCount: retryResult.totalAttempts - 1,
    actionRequired: parsedErr.actionRequired,
  });

  return {
    ok: false,
    duracaoMs: totalDuration,
    status: Number(parsedErr.code) || 500,
    error: parsedErr.userMessage,
    parsedError: parsedErr,
    raw: lastRaw,
    responseHeaders: lastHeaders,
    requestPayload: finalPayload,
    formattedPhone: cleanPhone,
    isDevelopmentMode: parsedErr.isDevelopmentModeError,
  };
}

/**
 * Envio consciente da janela de 24h da Meta.
 * - Janela aberta -> mensagem de texto livre.
 * - Janela fechada -> template aprovado (WHATSAPP_FALLBACK_TEMPLATE). Sem template configurado,
 *   falha explicitamente em vez de gerar um falso positivo (texto livre fora da janela é aceito
 *   pela Meta mas nunca entregue).
 */
export async function sendSessionAwareText(
  to: string,
  text: string,
  options?: { agendamentoId?: string; pacienteNome?: string; profissionalNome?: string; evento?: string }
): Promise<CloudApiSendResult> {
  const validation = validateAndFormatPhone(to);
  const phone = validation.valid ? validation.formattedPhone : to;
  const config = await loadWhatsAppConfig();
  const open = await isSessionOpen(phone);

  if (open) {
    const res = await sendRawCloudApiMessage(
      phone,
      { type: "text", text: { preview_url: true, body: text } },
      options
    );
    // Fora da janela (131047) mesmo com sessão registrada: cai para template.
    if (res.ok || Number(res.parsedError?.code) !== 131047) return res;
  }

  if (!config.fallback_template) {
    const err =
      "Janela de 24h fechada para este número e nenhum template aprovado configurado (WHATSAPP_FALLBACK_TEMPLATE). A Meta não entrega mensagens de texto livre fora da janela de atendimento.";
    console.error(`[whatsapp:cloudApi] ${err} | Número: ${phone}`);
    await logWhatsAppExecution({
      evento: options?.evento,
      agendamentoId: options?.agendamentoId,
      pacienteNome: options?.pacienteNome,
      profissionalNome: options?.profissionalNome,
      destinatarioTelefone: phone,
      mensagem: text,
      statusEnvio: "ERRO",
      duracaoMs: 0,
      ultimoErro: err,
      actionRequired:
        "Crie/aprove um template na Meta e informe o nome em WHATSAPP_FALLBACK_TEMPLATE, ou peça ao destinatário para enviar uma mensagem primeiro.",
    });
    return { ok: false, duracaoMs: 0, status: 400, error: err, formattedPhone: phone };
  }

  return sendRawCloudApiMessage(
    phone,
    {
      type: "template",
      template: {
        name: config.fallback_template,
        language: { code: config.fallback_template_lang || "pt_BR" },
      },
    },
    { ...options, templateName: config.fallback_template }
  );
}
