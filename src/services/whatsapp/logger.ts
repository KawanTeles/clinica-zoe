/**
 * Meta WhatsApp Cloud API - Detailed Execution Logger
 * Registra cada requisição, payload, resposta da Meta, tempo de resposta, erros e stack traces.
 * NADA É OCULTADO.
 */

export interface WhatsAppLogPayload {
  agendamentoId?: string;
  evento?: string;
  pacienteNome?: string;
  profissionalNome?: string;
  destinatarioTelefone: string;
  mensagem: string;
  templateName?: string;
  payloadEnviado?: any;
  respostaMeta?: any;
  responseHeaders?: Record<string, string>;
  httpStatus?: number;

  duracaoMs: number;
  statusEnvio: "PENDENTE" | "ENVIANDO" | "ENVIADA" | "ENTREGUE" | "LIDO" | "RECEBIDO" | "ERRO" | "CANCELADA";
  messageStatus?: string;
  conversationId?: string | null;
  conversationCategory?: string | null;
  erroCodigo?: string;
  erroDetalhe?: string;
  acceptedAt?: string;
  failedAt?: string;
  ultimoErro?: string;
  stackTrace?: string;
  retryCount?: number;
  actionRequired?: string;
}

/**
 * Registra log completo no console e na tabela `whatsapp_message_logs` (e `notificacoes`).
 */
export async function logWhatsAppExecution(logData: WhatsAppLogPayload): Promise<void> {
  const timestamp = new Date().toISOString();
  const logPrefix = `[whatsapp:logger][${timestamp}]`;

  console.log(`${logPrefix} Target: ${logData.destinatarioTelefone} | Evento: ${logData.evento ?? "-"} | Status: ${logData.statusEnvio}/${logData.messageStatus ?? "-"} | HTTP ${logData.httpStatus ?? 0} | Latency: ${logData.duracaoMs}ms | Retry: ${logData.retryCount ?? 0}`);
  if (logData.pacienteNome) console.log(`${logPrefix} Paciente: ${logData.pacienteNome}`);
  if (logData.profissionalNome) console.log(`${logPrefix} Profissional: ${logData.profissionalNome}`);
  if (logData.ultimoErro) console.error(`${logPrefix} ERRO: ${logData.ultimoErro}`);
  if (logData.actionRequired) console.warn(`${logPrefix} AÇÃO NECESSÁRIA: ${logData.actionRequired}`);
  if (logData.stackTrace) console.error(`${logPrefix} STACK TRACE:\n${logData.stackTrace}`);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Extract wamid if present in Meta response
    const wamid = logData.respostaMeta?.messages?.[0]?.id || logData.respostaMeta?.wamid || null;

    const logRecord = {
      agendamento_id: logData.agendamentoId || null,
      evento: logData.evento || null,
      destinatario_telefone: logData.destinatarioTelefone,
      paciente_nome: logData.pacienteNome || null,
      profissional_nome: logData.profissionalNome || null,
      mensagem: logData.mensagem,
      template_name: logData.templateName || "text",
      status_envio: logData.statusEnvio,
      message_status: logData.messageStatus || null,
      conversation_id: logData.conversationId || null,
      conversation_category: logData.conversationCategory || null,
      erro_codigo: logData.erroCodigo || null,
      erro_detalhe: logData.erroDetalhe || null,
      accepted_at: logData.acceptedAt || null,
      failed_at: logData.failedAt || null,
      wamid,
      duracao_ms: logData.duracaoMs,
      ultimo_erro: logData.ultimoErro || null,
      payload: {
        payload_enviado: logData.payloadEnviado,
        resposta_meta: logData.respostaMeta,
        response_headers: logData.responseHeaders ?? null,

        http_status: logData.httpStatus,
        retry_count: logData.retryCount ?? 0,
        stack_trace: logData.stackTrace || null,
        action_required: logData.actionRequired || null,
      },
    };

    await (supabaseAdmin as any).from("whatsapp_message_logs").insert(logRecord);
  } catch (err) {
    console.warn(`${logPrefix} Falha ao gravar log no banco de dados:`, (err as Error).message);
  }
}
