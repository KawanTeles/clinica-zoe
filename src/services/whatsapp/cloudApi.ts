/**
 * Meta WhatsApp Cloud API - Cloud API Service
 * Centralized low-level communication with Meta Graph API (v20.0).
 * Server-only module.
 */

import { validateAndFormatPhone } from "./validator";
import { parseMetaApiError, MetaParsedError } from "./errors";
import { logWhatsAppExecution } from "./logger";
import { executeWithRetry } from "./retry";

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
  parsedError?: MetaParsedError;
  raw?: any;
  formattedPhone?: string;
  isDevelopmentMode?: boolean;
}

/**
 * Carrega a configuração do WhatsApp garantindo que nenhuma credencial esteja hardcoded.
 * Prioridade: Banco (`whatsapp_meta_config`) -> Variáveis de Ambiente (`WHATSAPP_*` / `META_*`)
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
    console.warn("[whatsapp:cloudApi] Aviso ao ler whatsapp_meta_config do banco, usando env vars:", (e as Error).message);
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
 * Envia mensagem via Meta WhatsApp Cloud API com sanitização de telefone, retry com backoff e logging completo.
 */
export async function sendRawCloudApiMessage(
  recipientTo: string,
  bodyPayload: Record<string, any>,
  options?: {
    agendamentoId?: string;
    pacienteNome?: string;
    profissionalNome?: string;
    templateName?: string;
  }
): Promise<CloudApiSendResult> {
  const config = await loadWhatsAppConfig();
  const startTime = Date.now();

  // 1. Sanitização e Validação do Número de Telefone
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

  // 2. Validação de Credenciais
  if (!config.access_token || !config.phone_number_id) {
    const credError = "Credenciais do Meta WhatsApp Cloud API não configuradas (Access Token / Phone Number ID ausentes)";
    console.error(`[whatsapp:cloudApi] ${credError}`);

    const parsedErr = parseMetaApiError({ error: { message: credError } }, 401);

    await logWhatsAppExecution({
      agendamentoId: options?.agendamentoId,
      pacienteNome: options?.pacienteNome,
      profissionalNome: options?.profissionalNome,
      destinatarioTelefone: cleanPhone,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      statusEnvio: "ERRO",
      duracaoMs: Date.now() - startTime,
      ultimoErro: credError,
      actionRequired: "Informe as credenciais WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.",
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

  const version = config.graph_version || "v20.0";
  const url = `https://graph.facebook.com/${version}/${config.phone_number_id}/messages`;

  const finalPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    ...bodyPayload,
  };

  // 3. Execução com Retry Exponencial
  const retryResult = await executeWithRetry(async (attempt) => {
    const attemptStart = Date.now();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalPayload),
      });

      const attemptDur = Date.now() - attemptStart;
      const raw = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = raw?.error?.message || `Erro HTTP ${response.status}: ${response.statusText}`;
        return {
          ok: false,
          status: response.status,
          raw,
          error: errorMsg,
          duracaoMs: attemptDur,
        };
      }

      return {
        ok: true,
        status: response.status,
        raw,
        duracaoMs: attemptDur,
      };
    } catch (e) {
      return {
        ok: false,
        status: 500,
        error: (e as Error).message,
        duracaoMs: Date.now() - attemptStart,
      };
    }
  }, { maxRetries: 3, initialDelayMs: 500 });

  const totalDuration = Date.now() - startTime;
  const lastRaw = retryResult.data || retryResult.parsedError?.rawError;
  const wamid = lastRaw?.messages?.[0]?.id ?? undefined;

  if (retryResult.success) {
    console.log(`[whatsapp:cloudApi] Sucesso no envio para ${cleanPhone} (wamid: ${wamid}) em ${totalDuration}ms após ${retryResult.totalAttempts} tentativa(s).`);

    await logWhatsAppExecution({
      agendamentoId: options?.agendamentoId,
      pacienteNome: options?.pacienteNome,
      profissionalNome: options?.profissionalNome,
      destinatarioTelefone: cleanPhone,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      payloadEnviado: finalPayload,
      respostaMeta: lastRaw,
      httpStatus: 200,
      duracaoMs: totalDuration,
      statusEnvio: "ENVIADA",
      retryCount: retryResult.totalAttempts - 1,
    });

    return {
      ok: true,
      wamid,
      duracaoMs: totalDuration,
      status: 200,
      raw: lastRaw,
      formattedPhone: cleanPhone,
    };
  } else {
    const parsedErr = retryResult.parsedError || parseMetaApiError(lastRaw, 500);

    console.error(
      `[whatsapp:cloudApi] Falha no envio para ${cleanPhone} após ${retryResult.totalAttempts} tentativa(s):`,
      parsedErr.technicalDiagnostic
    );

    await logWhatsAppExecution({
      agendamentoId: options?.agendamentoId,
      pacienteNome: options?.pacienteNome,
      profissionalNome: options?.profissionalNome,
      destinatarioTelefone: cleanPhone,
      mensagem: bodyPayload.text?.body || JSON.stringify(bodyPayload),
      templateName: options?.templateName,
      payloadEnviado: finalPayload,
      respostaMeta: lastRaw,
      httpStatus: Number(parsedErr.code) || 500,
      duracaoMs: totalDuration,
      statusEnvio: "ERRO",
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
      formattedPhone: cleanPhone,
      isDevelopmentMode: parsedErr.isDevelopmentModeError,
    };
  }
}
