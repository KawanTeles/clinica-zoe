import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint de diagnóstico da integração Meta WhatsApp Cloud API.
 *
 * GET  /api/public/test-whatsapp?secret=...            -> diagnóstico (token, phone number id, templates)
 * POST /api/public/test-whatsapp?secret=...            -> envia mensagem de teste
 *      body: { "to": "5582998343617", "text": "...", "template": "hello_world", "language": "en_US" }
 *
 * Protegido pelo segredo WHATSAPP_TEST_SECRET (ou WHATSAPP_VERIFY_TOKEN).
 * Retorna integralmente: payload enviado, status HTTP, headers, JSON da Meta, wamid, erro e duração.
 */
export const Route = createFileRoute("/api/public/test-whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const guard = authorize(request);
        if (guard) return guard;

        const { loadWhatsAppConfig, GRAPH_VERSION_DEFAULT } = await import("@/services/whatsapp/cloudApi");
        const cfg = await loadWhatsAppConfig();
        const version = cfg.graph_version || GRAPH_VERSION_DEFAULT;

        const diag: Record<string, unknown> = {
          graph_version: version,
          phone_number_id: cfg.phone_number_id || null,
          business_account_id: cfg.business_account_id || null,
          access_token_presente: !!cfg.access_token,
          access_token_tamanho: cfg.access_token.length,
          fallback_template: cfg.fallback_template || null,
          endpoint: `POST https://graph.facebook.com/${version}/${cfg.phone_number_id}/messages`,
        };

        if (!cfg.access_token || !cfg.phone_number_id) {
          return Response.json({ ok: false, error: "Credenciais ausentes neste ambiente.", diag }, { status: 500 });
        }

        const t0 = Date.now();
        const numberResp = await fetch(
          `https://graph.facebook.com/${version}/${cfg.phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating`,
          { headers: { Authorization: `Bearer ${cfg.access_token}` } },
        );
        const numberJson = await numberResp.json().catch(() => null);

        let templates: unknown = null;
        if (cfg.business_account_id) {
          const tplResp = await fetch(
            `https://graph.facebook.com/${version}/${cfg.business_account_id}/message_templates?fields=name,status,language,category&limit=50`,
            { headers: { Authorization: `Bearer ${cfg.access_token}` } },
          );
          templates = await tplResp.json().catch(() => null);
        }

        return Response.json({
          ok: numberResp.ok,
          duracaoMs: Date.now() - t0,
          diag,
          numero: { httpStatus: numberResp.status, body: numberJson },
          templates,
        });
      },

      POST: async ({ request }) => {
        const guard = authorize(request);
        if (guard) return guard;

        const body = (await request.json().catch(() => ({}))) as {
          to?: string;
          text?: string;
          template?: string;
          language?: string;
        };

        if (!body.to) return Response.json({ ok: false, error: "Informe 'to' no corpo da requisição." }, { status: 400 });

        const { sendRawCloudApiMessage } = await import("@/services/whatsapp/cloudApi");
        const t0 = Date.now();

        const payload = body.template
          ? {
              type: "template",
              template: { name: body.template, language: { code: body.language || "pt_BR" } },
            }
          : {
              type: "text",
              text: { preview_url: true, body: body.text || "Mensagem de teste da Clínica Zoe." },
            };

        const result = await sendRawCloudApiMessage(body.to, payload, { templateName: body.template });

        return Response.json(
          {
            ok: result.ok,
            duracaoMs: result.duracaoMs,
            tempoTotalMs: Date.now() - t0,
            httpStatus: result.status,
            wamid: result.wamid ?? null,
            messageStatus: result.messageStatus ?? null,
            numeroFormatado: result.formattedPhone,
            payloadEnviado: result.requestPayload,
            respostaHeaders: result.responseHeaders,
            respostaMeta: result.raw,
            erro: result.error ?? null,
            erroDetalhado: result.parsedError ?? null,
          },
          { status: result.ok ? 200 : 502 },
        );
      },
    },
  },
});

function authorize(request: Request): Response | null {
  const expected = process.env.WHATSAPP_TEST_SECRET || process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) return Response.json({ ok: false, error: "WHATSAPP_TEST_SECRET não configurado." }, { status: 503 });
  const url = new URL(request.url);
  const provided = url.searchParams.get("secret") || request.headers.get("x-test-secret");
  if (provided !== expected) return new Response("Não autorizado", { status: 401 });
  return null;
}
