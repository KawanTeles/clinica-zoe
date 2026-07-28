import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint de Webhook Oficial da Meta WhatsApp Cloud API (Graph API)
 * URL: /api/public/hooks/meta
 */
export const Route = createFileRoute("/api/public/hooks/meta")({
  server: {
    handlers: {
      // 1. Validação de Webhook da Meta (Desafio GET)
      GET: async ({ request }) => {
        const { loadMetaConfigServer } = await import("@/lib/meta.functions");
        const config = await loadMetaConfigServer();

        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const expectedToken = config.verify_token || "clinica_zoe_verify_token_2026";

        if (mode === "subscribe" && token === expectedToken) {
          return new Response(challenge ?? "", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }

        return new Response("Token de verificação inválido", { status: 403 });
      },

      // 2. Recebimento de Eventos (Mensagens e Statuses POST)
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { loadMetaConfigServer } = await import("@/lib/meta.functions");
        const { verifyMetaSignature, parseMetaWebhookBody } = await import(
          "@/lib/services/meta-webhook.service"
        );
        const { processQueue } = await import("@/lib/notifications/queue.server");

        const config = await loadMetaConfigServer();
        const rawBodyText = await request.text();

        // Validação de Assinatura X-Hub-Signature-256
        const signatureHeader = request.headers.get("x-hub-signature-256");
        if (config.app_secret && signatureHeader) {
          const isValid = verifyMetaSignature(rawBodyText, signatureHeader, config.app_secret);
          if (!isValid) {
            return new Response("Assinatura do Webhook Inválida", { status: 401 });
          }
        }

        try {
          const body = JSON.parse(rawBodyText || "{}");
          const parsedEvents = parseMetaWebhookBody(body);

          for (const ev of parsedEvents) {
            if (ev.type === "message" && ev.fromPhone && ev.text) {
              // Invocação da RPC para interpretar respostas (CONFIRMAR, RECUSAR, REMARCAR)
              const { data: rpcRes, error: rpcErr } = await (supabaseAdmin as any).rpc(
                "processar_resposta_meta_profissional",
                {
                  _telefone_prof: ev.fromPhone,
                  _resposta: ev.text,
                  _wamid: ev.wamid ?? null,
                },
              );

              if (!rpcErr && rpcRes?.ok) {
                // Dispara o envio imediato da mensagem de confirmação para o paciente
                void processQueue(10).catch(() => {});
              }
            } else if (ev.type === "status" && ev.wamid) {
              const statusUpper = (ev.statusText || "").toUpperCase();
              let targetStatus: string | null = null;
              if (statusUpper === "DELIVERED") targetStatus = "ENTREGUE";
              else if (statusUpper === "READ") targetStatus = "LIDO";
              else if (statusUpper === "FAILED") targetStatus = "ERRO";

              if (targetStatus) {
                await (supabaseAdmin as any)
                  .from("notificacoes")
                  .update({
                    status_envio: targetStatus,
                    ...(targetStatus === "ENTREGUE" ? { entregue_em: new Date().toISOString() } : {}),
                    ...(targetStatus === "LIDO" ? { lido_em: new Date().toISOString() } : {}),
                  })
                  .eq("provider_message_id", ev.wamid);
              }
            }
          }

          return Response.json({ ok: true });
        } catch (e) {
          console.error("[webhook:meta]", e);
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
