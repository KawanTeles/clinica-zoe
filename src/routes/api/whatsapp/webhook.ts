import { createFileRoute } from "@tanstack/react-router";
import { handleWebhookGet, handleWebhookPost } from "@/services/whatsapp/webhook";

/**
 * Endpoint alternativo para o Webhook do WhatsApp Cloud API
 * URL: /api/whatsapp/webhook
 */
export const Route = createFileRoute("/api/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return handleWebhookGet(request);
      },
      POST: async ({ request }) => {
        return handleWebhookPost(request);
      },
    },
  },
});
