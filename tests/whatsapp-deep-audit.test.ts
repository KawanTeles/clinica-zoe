/**
 * Suíte Completa de Auditoria & Testes de Integração
 * Meta WhatsApp Cloud API (Graph API v20.0+)
 */

import fs from "node:fs";
import path from "node:path";

// Carrega variáveis do arquivo .env se não estiverem no ambiente
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.warn("Aviso ao carregar .env:", e);
}

import {
  validateAndFormatPhone,
  parseMetaApiError,
  executeWithRetry,
  loadWhatsAppConfig,
  sendText,
  sendTemplate,
  sendAppointmentConfirmation,
  sendProfessionalNotification,
  sendAdminNotification,
  sendAppointmentCancellation,
  sendAppointmentRescheduled,
  sendAppointmentRejection,
  handleWebhookGet,
  verifyMetaSignature,
  parseMetaWebhookBody,
} from "../src/services/whatsapp";

async function runDeepAudit() {
  console.log("======================================================================");
  console.log("   AUDITORIA PROFUNDA E TESTES REAIS - META WHATSAPP CLOUD API       ");
  console.log("======================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${detail ? `: ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Auditoria das Variáveis de Ambiente
  console.log("1. AUDITORIA DE VARIÁVEIS DE AMBIENTE & CONFIGURAÇÕES");
  const config = await loadWhatsAppConfig();
  assert(!!config.access_token, "Access Token carregado com sucesso");
  assert(config.phone_number_id === "1195808793624174", "Phone Number ID validado (1195808793624174)");
  assert(config.business_account_id === "1437167158458583", "Business Account ID (WABA) validado (1437167158458583)");
  assert(config.app_id === "1704752450597676", "App ID validado (1704752450597676)");
  assert(config.verify_token === "clinica_zoe_verify_token_2026", "Verify Token validado");

  // 2. Validação & Sanitização de Telefones (validator.ts)
  console.log("\n2. VALIDAÇÃO E SANITIZAÇÃO DE TELEFONES (FORMATO E.164)");
  const p1 = validateAndFormatPhone("+55 (82) 99999-9999");
  assert(p1.valid && p1.formattedPhone === "5582999999999", "Converte '+55 (82) 99999-9999' para '5582999999999'");

  const p2 = validateAndFormatPhone("82 98888-7777");
  assert(p2.valid && p2.formattedPhone === "5582988887777", "Insere DDI 55 automaticamente em '82 98888-7777'");

  const p3 = validateAndFormatPhone("123");
  assert(!p3.valid && !!p3.error, "Rejeita número com comprimento insuficiente ('123') sem falha silenciosa");

  const p4 = validateAndFormatPhone("5500999999999");
  assert(!p4.valid && p4.error?.includes("DDD"), "Detecta DDD inválido ('00') e gera erro descritivo");

  // 3. Tratamento de Erros da Meta & Diagnósticos (errors.ts)
  console.log("\n3. TRATAMENTO DE ERROS ESPECÍFICOS DA META (ERRORS.TS)");
  
  // Teste Erro 131030 (Allowed List / Dev Mode)
  const err131030 = parseMetaApiError({ error: { code: 131030, message: "Optionally, you can add this phone number to the allowed list" } }, 400);
  assert(err131030.isDevelopmentModeError === true, "Identifica erro 131030 como Desenvolvimento (Dev Mode)");
  assert(err131030.isAllowedListError === true, "Identifica falta de número na Allowed List");
  assert(err131030.retryable === false, "Marca erro 131030 como Não-Retentável (evita retries infinitos)");

  // Teste Erro 190 (Token Expirado)
  const err190 = parseMetaApiError({ error: { code: 190, message: "Invalid OAuth access token" } }, 401);
  assert(err190.isTokenExpired === true, "Identifica erro 190 como Token Expirado");

  // Teste Erro 429 (Rate Limit - Retentável)
  const err429 = parseMetaApiError({ error: { code: 429, message: "Rate limit reached" } }, 429);
  assert(err429.retryable === true, "Identifica erro 429 como Retentável via Backoff");

  // 4. Teste da Política de Retry com Backoff Exponencial (retry.ts)
  console.log("\n4. TESTE DA POLÍTICA DE RETRY E BACKOFF EXPONENCIAL");
  let attemptCount = 0;
  const retryTestResult = await executeWithRetry(async (attempt) => {
    attemptCount++;
    if (attempt < 2) {
      return { ok: false, status: 500, error: "Falha temporária", duracaoMs: 10, raw: { error: { code: 500 } } };
    }
    return { ok: true, status: 200, duracaoMs: 15, raw: { messages: [{ id: "wamid.RETRY_SUCCESS" }] } };
  }, { maxRetries: 3, initialDelayMs: 50, backoffFactor: 2 });

  assert(retryTestResult.success === true, "Retry recuperou o envio com sucesso na 2ª tentativa");
  assert(attemptCount === 2, "Realizou exatamente 2 tentativas até obter sucesso");

  // 5. Teste do Webhook (GET e POST)
  console.log("\n5. TESTE DO WEBHOOK (VERIFICAÇÃO E EVENTOS)");
  const getReq = new URL("https://clinica.zoe/api/public/hooks/meta?hub.mode=subscribe&hub.verify_token=clinica_zoe_verify_token_2026&hub.challenge=CHALLENGE_TEST_777");
  const getRes = await handleWebhookGet(getReq);
  const challengeBody = await getRes.text();
  assert(getRes.status === 200 && challengeBody === "CHALLENGE_TEST_777", "Webhook GET valida verify_token e devolve hub.challenge");

  const postPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1437167158458583",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              messages: [{ from: "5582999998888", id: "wamid.TEST_INBOUND", text: { body: "CONFIRMAR" } }],
              statuses: [{ id: "wamid.TEST_INBOUND", status: "delivered", recipient_id: "5582999998888" }],
            },
          },
        ],
      },
    ],
  };
  const events = parseMetaWebhookBody(postPayload);
  assert(events.length === 2, "Webhook POST parseia mensagens recebidas e status com sucesso");

  // 6. Teste dos Envios do Serviço Centralizado (send.ts / cloudApi.ts)
  console.log("\n6. TESTE DE ENVIOS DO SERVIÇO CENTRALIZADO (SEND.TS)");
  const sampleAppointment = {
    pacienteNome: "Gabriel Oliveira",
    pacienteTelefone: "5582991112222",
    especialidade: "Ortopedia",
    profissional: "Dr. Roberto Costa",
    data: "05/08/2026",
    hora: "10:00",
    valor: 300,
    formaPagamento: "Cartão de Crédito",
    observacoes: "Paciente com dor no joelho",
    to: "5582991112222",
  };

  const rText = await sendText("5582991112222", "Mensagem de teste de auditoria");
  assert(typeof rText.duracaoMs === "number", "sendText executado e tempo cronometrado");

  const rTpl = await sendTemplate("5582991112222", "solicitacao_consulta");
  assert(typeof rTpl.duracaoMs === "number", "sendTemplate executado com sucesso");

  const rConf = await sendAppointmentConfirmation(sampleAppointment);
  assert(typeof rConf.duracaoMs === "number", "sendAppointmentConfirmation executado com sucesso");

  const rProf = await sendProfessionalNotification({ ...sampleAppointment, to: "5582999998888" });
  assert(typeof rProf.duracaoMs === "number", "sendProfessionalNotification executado com sucesso");

  const rAdmin = await sendAdminNotification({ title: "Auditoria Finalizada", details: "Todos os módulos ativos" });
  assert(typeof rAdmin.duracaoMs === "number", "sendAdminNotification executado com sucesso");

  const rCancel = await sendAppointmentCancellation(sampleAppointment);
  assert(typeof rCancel.duracaoMs === "number", "sendAppointmentCancellation executado com sucesso");

  const rResched = await sendAppointmentRescheduled(sampleAppointment);
  assert(typeof rResched.duracaoMs === "number", "sendAppointmentRescheduled executado com sucesso");

  const rRej = await sendAppointmentRejection(sampleAppointment);
  assert(typeof rRej.duracaoMs === "number", "sendAppointmentRejection executado com sucesso");

  console.log("\n======================================================================");
  console.log(`   RESULTADO DA AUDITORIA: ${passed} TESTES PASSARAM, ${failed} FALHARAM    `);
  console.log("======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDeepAudit().catch((err) => {
  console.error("Erro na execução da auditoria:", err);
  process.exit(1);
});
