import crypto from "node:crypto";

export interface ParsedMetaInboundMessage {
  type: "message" | "status";
  fromPhone?: string;
  wamid?: string;
  text?: string;
  statusText?: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  raw?: any;
}

/**
 * Service do Webhook da Meta WhatsApp Cloud API
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return true; // Se secret não configurado, ignora
  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const cleanSignature = signatureHeader.replace(/^sha256=/i, "");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(cleanSignature, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Processa Payload do Webhook da Meta
 */
export function parseMetaWebhookBody(body: any): ParsedMetaInboundMessage[] {
  const results: ParsedMetaInboundMessage[] = [];
  if (!body || body.object !== "whatsapp_business_account") return results;

  const entries = body.entry ?? [];
  for (const entry of entries) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const value = change.value ?? {};

      // 1. Mensagens Recebidas
      const messages = value.messages ?? [];
      for (const msg of messages) {
        const fromPhone = msg.from;
        const wamid = msg.id;
        const text =
          msg.text?.body ??
          msg.button?.text ??
          msg.interactive?.button_reply?.title ??
          msg.interactive?.list_reply?.title ??
          "";

        results.push({
          type: "message",
          fromPhone,
          wamid,
          text,
          timestamp: msg.timestamp,
          raw: msg,
        });
      }

      // 2. Atualizações de Status
      const statuses = value.statuses ?? [];
      for (const st of statuses) {
        results.push({
          type: "status",
          fromPhone: st.recipient_id,
          wamid: st.id,
          statusText: st.status,
          timestamp: st.timestamp,
          raw: st,
        });
      }
    }
  }

  return results;
}
