/**
 * Provider abstraction for outbound messaging (WhatsApp/E-mail).
 * Server-only. Never import from client code.
 *
 * Add new providers by implementing MessageProvider and registering below.
 * Env-driven selection keeps the app decoupled from a single vendor.
 */

export type OutboundChannel = "WHATSAPP" | "EMAIL";

export interface OutboundMessage {
  channel: OutboundChannel;
  to: string; // phone (E.164) or email
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface DeliveryResult {
  ok: boolean;
  providerId?: string;
  error?: string;
  raw?: unknown;
}

export interface MessageProvider {
  id: string;
  supports(channel: OutboundChannel): boolean;
  send(msg: OutboundMessage): Promise<DeliveryResult>;
}

/** No-op logger provider used until a real integration is configured. */
class ConsoleProvider implements MessageProvider {
  id = "console";
  supports(channel: OutboundChannel) {
    return channel === "WHATSAPP" || channel === "EMAIL";
  }
  async send(msg: OutboundMessage): Promise<DeliveryResult> {
    console.log(`[notif:${this.id}] ${msg.channel} -> ${msg.to}: ${msg.title}`);
    return { ok: true, providerId: `console_${Date.now()}` };
  }
}

/** Stub Evolution API provider — enabled when EVOLUTION_API_URL is set. */
class EvolutionProvider implements MessageProvider {
  id = "evolution";
  supports(channel: OutboundChannel) {
    return channel === "WHATSAPP";
  }
  async send(msg: OutboundMessage): Promise<DeliveryResult> {
    const url = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;
    if (!url || !key || !instance) {
      return { ok: false, error: "Evolution API não configurada" };
    }
    try {
      const resp = await fetch(`${url}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({ number: msg.to, text: `${msg.title}\n\n${msg.body}` }),
      });
      const raw = await resp.json().catch(() => null);
      if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}`, raw };
      return { ok: true, providerId: (raw as any)?.key?.id, raw };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

const providers: MessageProvider[] = [new EvolutionProvider(), new ConsoleProvider()];

export function pickProvider(channel: OutboundChannel): MessageProvider {
  const preferred = process.env.NOTIF_PROVIDER;
  if (preferred) {
    const match = providers.find((p) => p.id === preferred && p.supports(channel));
    if (match) return match;
  }
  const found = providers.find((p) => p.supports(channel));
  if (!found) throw new Error(`Nenhum provider disponível para canal ${channel}`);
  return found;
}
