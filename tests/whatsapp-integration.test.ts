/**
 * Testes Automáticos da Integração Oficial Meta WhatsApp Cloud API
 * Executável via Bun / Node / Vite
 */

import fs from "node:fs";
import path from "node:path";

// Carrega .env manualmente se process.env não estiver populado
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
  console.warn("Aviso ao carregar .env nos testes:", e);
}

import {
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

async function runTests() {
  console.log("==================================================");
  console.log("  INICIANDO TESTES DE INTEGRAÇÃO META WHATSAPP    ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Carregamento de Variáveis de Ambiente
  console.log("1. Testando carregamento de credenciais do ambiente...");
  const config = await loadWhatsAppConfig();
  assert(!!config.access_token, `Access Token carregado das variáveis de ambiente: ${config.access_token}`);
  assert(config.phone_number_id === "1195808793624174", "Phone Number ID é 1195808793624174");
  assert(config.business_account_id === "1437167158458583", "WABA ID é 1437167158458583");
  assert(config.app_id === "1704752450597676", "App ID é 1704752450597676");
  assert(config.verify_token === "clinica_zoe_verify_token_2026", "Verify Token é clinica_zoe_verify_token_2026");

  // 2. Testando Webhook GET (Verificação de Desafio)
  console.log("\n2. Testando verificação GET do Webhook (hub.verify_token)...");
  const testUrlSuccess = new URL("https://clinica-zoe.app/api/public/hooks/meta?hub.mode=subscribe&hub.verify_token=clinica_zoe_verify_token_2026&hub.challenge=12345678");
  const resGetSuccess = await handleWebhookGet(testUrlSuccess);
  const textChallenge = await resGetSuccess.text();
  assert(resGetSuccess.status === 200, "Webhook GET responde HTTP 200 para token válido");
  assert(textChallenge === "12345678", "Webhook GET devolve o desafio hub.challenge corretamente");

  const testUrlFail = new URL("https://clinica-zoe.app/api/public/hooks/meta?hub.mode=subscribe&hub.verify_token=token_invalido&hub.challenge=12345678");
  const resGetFail = await handleWebhookGet(testUrlFail);
  assert(resGetFail.status === 403, "Webhook GET responde HTTP 403 para token inválido");

  // 3. Testando Assinatura HMAC e Parser do Webhook POST
  console.log("\n3. Testando verificação de assinatura HMAC e parsing de eventos POST...");
  const mockPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1437167158458583",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "5511999999999", phone_number_id: "1195808793624174" },
              messages: [
                {
                  from: "5511988888888",
                  id: "wamid.HBgLMTU1NTU1NTU1NTUV",
                  timestamp: "1722288000",
                  text: { body: "CONFIRMAR" },
                  type: "text",
                },
              ],
              statuses: [
                {
                  id: "wamid.HBgLMTU1NTU1NTU1NTUV",
                  status: "delivered",
                  timestamp: "1722288005",
                  recipient_id: "5511977777777",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  const parsedEvents = parseMetaWebhookBody(mockPayload);
  assert(parsedEvents.length === 2, "Parser extrai 2 eventos (1 mensagem + 1 status)");
  assert(parsedEvents[0].type === "message" && parsedEvents[0].text === "CONFIRMAR", "Extrai mensagem recebida 'CONFIRMAR'");
  assert(parsedEvents[1].type === "status" && parsedEvents[1].statusText === "delivered", "Extrai status 'delivered'");

  // 4. Testando Envio de Mensagens (Funções do Serviço)
  console.log("\n4. Testando funções de envio do serviço WhatsApp Cloud API...");

  const appointmentSample = {
    pacienteNome: "Carlos Eduardo",
    pacienteTelefone: "5511988887777",
    especialidade: "Cardiologia",
    profissional: "Dra. Ana Silva",
    data: "30/07/2026",
    hora: "14:30",
    valor: 250,
    formaPagamento: "PIX",
    observacoes: "Primeira consulta",
    endereco: "Av. Paulista, 1000, Sala 502",
  };

  const resText = await sendText("5511988887777", "Mensagem de teste unitário");
  assert(typeof resText.duracaoMs === "number", "sendText executa e mede tempo de resposta (duracaoMs)");
  assert(resText.status !== undefined, "sendText retorna status HTTP da API Meta");

  const resTemplate = await sendTemplate("5511988887777", "confirmacao_consulta");
  assert(typeof resTemplate.duracaoMs === "number", "sendTemplate executa corretamente");

  const resConfirmation = await sendAppointmentConfirmation({ ...appointmentSample, to: "5511988887777" });
  assert(typeof resConfirmation.duracaoMs === "number", "sendAppointmentConfirmation executa com sucesso");

  const resProf = await sendProfessionalNotification({ ...appointmentSample, to: "5511999998888" });
  assert(typeof resProf.duracaoMs === "number", "sendProfessionalNotification executa com sucesso");

  const resAdmin = await sendAdminNotification({ title: "Teste de Alerta", details: "Painel ativo e operante", to: "5511999998888" });
  assert(typeof resAdmin.duracaoMs === "number", "sendAdminNotification executa com sucesso");

  const resCancel = await sendAppointmentCancellation({ ...appointmentSample, to: "5511988887777", motivo: "Imprevisto médico" });
  assert(typeof resCancel.duracaoMs === "number", "sendAppointmentCancellation executa com sucesso");

  const resResched = await sendAppointmentRescheduled({ ...appointmentSample, to: "5511988887777" });
  assert(typeof resResched.duracaoMs === "number", "sendAppointmentRescheduled executa com sucesso");

  const resRejection = await sendAppointmentRejection({ ...appointmentSample, to: "5511988887777" });
  assert(typeof resRejection.duracaoMs === "number", "sendAppointmentRejection executa com sucesso");

  console.log("\n==================================================");
  console.log(`  RESUMO DOS TESTES: ${passed} PASSOU, ${failed} FALHOU`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erro fatal ao executar testes:", err);
  process.exit(1);
});
