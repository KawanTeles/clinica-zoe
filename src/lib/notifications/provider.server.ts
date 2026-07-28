/**
 * Provider abstraction for outbound messaging (WhatsApp/E-mail).
 * Server-only. Never import from client code.
 *
 * A configuração (provider, url, token, remetente) vive na tabela
 * `notificacoes_config`, acessível apenas pelo service role — o token
 * nunca é enviado ao frontend.
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

export interface ProviderConfig {
  provider: string;
  provider_url: string | null;
  provider_token: string | null;
  remetente: string | null;
  /** Evolution: nome da instância. */
  provider_instancia: string | null;
  /** Meta Cloud: phone_number_id. */
  provider_phone_number_id: string | null;
  /** Segredo usado para validar o webhook de status do provider. */
  webhook_secret: string | null;
  destinatario_solicitacao: string;
  lembrete_24h_ativo: boolean;
  lembrete_2h_ativo: boolean;
  conexao_status: string;
  conexao_testada_em: string | null;
  conexao_erro: string | null;
  janela_ativa: boolean;
  janela_inicio: string;
  janela_fim: string;
  templates: Record<string, string>;
}



export interface MessageProvider {
  id: string;
  supports(channel: OutboundChannel): boolean;
  send(msg: OutboundMessage, cfg: ProviderConfig): Promise<DeliveryResult>;
  /** Verificação leve de credenciais, usada pelo botão "Testar conexão". */
  test(cfg: ProviderConfig): Promise<DeliveryResult>;
}

const digits = (v: string) => v.replace(/\D/g, "");

/** Mensagem de erro legível, distinguindo falha de autenticação. */
function httpErro(status: number) {
  if (status === 401 || status === 403) return `Erro de autenticação (HTTP ${status})`;
  return `HTTP ${status}`;
}

/** Fallback: apenas registra em log. Útil em desenvolvimento. */
class ConsoleProvider implements MessageProvider {
  id = "console";
  supports() {
    return true;
  }
  async send(msg: OutboundMessage): Promise<DeliveryResult> {
    console.log(`[notif:${this.id}] ${msg.channel} -> ${msg.to}: ${msg.title}`);
    return { ok: true, providerId: `console_${Date.now()}` };
  }
  async test(): Promise<DeliveryResult> {
    return { ok: true, providerId: "console" };
  }
}

/** Evolution API (auto-hospedada). */
class EvolutionProvider implements MessageProvider {
  id = "evolution";
  supports(channel: OutboundChannel) {
    return channel === "WHATSAPP";
  }
  private base(cfg: ProviderConfig) {
    return (cfg.provider_url ?? "").replace(/\/+$/, "");
  }
  async send(msg: OutboundMessage, cfg: ProviderConfig): Promise<DeliveryResult> {
    const url = this.base(cfg);
    const key = cfg.provider_token;
    const instance = cfg.provider_instancia || cfg.remetente;
    if (!url || !key || !instance) return { ok: false, error: "Evolution API não configurada" };
    try {
      const resp = await fetch(`${url}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({ number: digits(msg.to), text: `${msg.title}\n\n${msg.body}` }),
      });
      const raw = await resp.json().catch(() => null);
      if (!resp.ok) return { ok: false, error: httpErro(resp.status), raw };
      return { ok: true, providerId: (raw as any)?.key?.id, raw };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  async test(cfg: ProviderConfig): Promise<DeliveryResult> {
    const url = this.base(cfg);
    const inst = cfg.provider_instancia || cfg.remetente;
    if (!url || !cfg.provider_token || !inst)
      return { ok: false, error: "Informe URL, token e instância." };
    try {
      const resp = await fetch(`${url}/instance/connectionState/${inst}`, {
        headers: { apikey: cfg.provider_token },
      });
      const raw = await resp.json().catch(() => null);
      if (!resp.ok) return { ok: false, error: httpErro(resp.status), raw };
      return { ok: true, raw };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

/** Meta WhatsApp Cloud API. */
class MetaCloudProvider implements MessageProvider {
  id = "meta";
  supports(channel: OutboundChannel) {
    return channel === "WHATSAPP";
  }
  private base(cfg: ProviderConfig) {
    return (cfg.provider_url || "https://graph.facebook.com/v20.0").replace(/\/+$/, "");
  }
  async send(msg: OutboundMessage, cfg: ProviderConfig): Promise<DeliveryResult> {
    const phoneId = cfg.provider_phone_number_id || cfg.remetente;
    if (!cfg.provider_token || !phoneId)
      return { ok: false, error: "Meta Cloud API não configurada" };
    try {
      const resp = await fetch(`${this.base(cfg)}/${phoneId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.provider_token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits(msg.to),
          type: "text",
          text: { body: `${msg.title}\n\n${msg.body}` },
        }),
      });
      const raw = await resp.json().catch(() => null);
      if (!resp.ok) return { ok: false, error: httpErro(resp.status), raw };
      return { ok: true, providerId: (raw as any)?.messages?.[0]?.id, raw };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  async test(cfg: ProviderConfig): Promise<DeliveryResult> {
    const phoneId = cfg.provider_phone_number_id || cfg.remetente;
    if (!cfg.provider_token || !phoneId)
      return { ok: false, error: "Informe token e Phone Number ID." };
    try {
      const resp = await fetch(`${this.base(cfg)}/${phoneId}`, {
        headers: { Authorization: `Bearer ${cfg.provider_token}` },
      });
      const raw = await resp.json().catch(() => null);
      if (!resp.ok) return { ok: false, error: httpErro(resp.status), raw };
      return { ok: true, raw };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

/**
 * Twilio (WhatsApp/SMS).
 * URL = Account SID base; token = "SID:TOKEN" ou token de API.
 */
class TwilioProvider implements MessageProvider {
  id = "twilio";
  supports(channel: OutboundChannel) {
    return channel === "WHATSAPP";
  }
  private auth(cfg: ProviderConfig) {
    const raw = cfg.provider_token ?? "";
    const [sid, token] = raw.includes(":") ? raw.split(":") : ["", raw];
    return { sid, token };
  }
  async send(msg: OutboundMessage, cfg: ProviderConfig): Promise<DeliveryResult> {
    const { sid, token } = this.auth(cfg);
    if (!sid || !token || !cfg.remetente)
      return { ok: false, error: "Twilio não configurado (use SID:TOKEN no campo token)." };
    try {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: `whatsapp:+${digits(msg.to)}`,
            From: `whatsapp:+${digits(cfg.remetente)}`,
            Body: `${msg.title}\n\n${msg.body}`,
          }),
        },
      );
      const raw = await resp.json().catch(() => null);
      if (!resp.ok) return { ok: false, error: httpErro(resp.status), raw };
      return { ok: true, providerId: (raw as any)?.sid, raw };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  async test(cfg: ProviderConfig): Promise<DeliveryResult> {
    const { sid, token } = this.auth(cfg);
    if (!sid || !token) return { ok: false, error: "Informe SID:TOKEN no campo token." };
    try {
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
      });
      if (!resp.ok) return { ok: false, error: httpErro(resp.status) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

const providers: MessageProvider[] = [
  new EvolutionProvider(),
  new MetaCloudProvider(),
  new TwilioProvider(),
  new ConsoleProvider(),
];

export const PROVIDER_IDS = providers.map((p) => p.id);

export const DEFAULT_CONFIG: ProviderConfig = {
  provider: "console",
  provider_url: null,
  provider_token: null,
  remetente: null,
  provider_instancia: null,
  provider_phone_number_id: null,
  webhook_secret: null,
  destinatario_solicitacao: "PROFISSIONAL",
  lembrete_24h_ativo: true,
  lembrete_2h_ativo: false,
  conexao_status: "NAO_TESTADA",
  conexao_testada_em: null,
  conexao_erro: null,
  janela_ativa: true,
  janela_inicio: "08:00",
  janela_fim: "20:00",
  templates: {},
};


/** Lê a configuração no banco (service role). Nunca exponha o token ao cliente. */
export async function loadConfig(): Promise<ProviderConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("notificacoes_config")
    .select("*")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...data } as ProviderConfig;
}

export function pickProvider(channel: OutboundChannel, cfg: ProviderConfig): MessageProvider {
  const match = providers.find((p) => p.id === cfg.provider && p.supports(channel));
  if (match) return match;
  const found = providers.find((p) => p.supports(channel));
  if (!found) throw new Error(`Nenhum provider disponível para canal ${channel}`);
  return found;
}
