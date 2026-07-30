/**
 * Provider abstraction for outbound messaging (WhatsApp/E-mail).
 * Server-only. Never import from client code.
 * Exclusively uses Meta WhatsApp Cloud API for WhatsApp messaging.
 */

import { sendSessionAwareText, loadWhatsAppConfig, GRAPH_VERSION_DEFAULT } from "@/services/whatsapp/cloudApi";

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
  provider_instancia: string | null;
  provider_phone_number_id: string | null;
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
  test(cfg: ProviderConfig): Promise<DeliveryResult>;
}

/** Official Meta WhatsApp Cloud API Provider */
class MetaCloudProvider implements MessageProvider {
  id = "meta";
  supports(channel: OutboundChannel) {
    return channel === "WHATSAPP";
  }

  async send(msg: OutboundMessage, _cfg: ProviderConfig): Promise<DeliveryResult> {
    const textContent = msg.title && !msg.body.startsWith(msg.title) ? `${msg.title}\n\n${msg.body}` : msg.body;
    const agendamentoId = (msg.metadata?.agendamento_id as string) || undefined;

    const result = await sendRawCloudApiMessage(
      msg.to,
      {
        type: "text",
        text: {
          preview_url: true,
          body: textContent,
        },
      },
      { agendamentoId }
    );

    return {
      ok: result.ok,
      providerId: result.wamid,
      error: result.error,
      raw: result.raw,
    };
  }

  async test(_cfg: ProviderConfig): Promise<DeliveryResult> {
    const waConfig = await loadWhatsAppConfig();
    if (!waConfig.access_token || !waConfig.phone_number_id) {
      return { ok: false, error: "Informe token e Phone Number ID da Meta Cloud API." };
    }
    try {
      const version = waConfig.graph_version || "v20.0";
      const resp = await fetch(`https://graph.facebook.com/${version}/${waConfig.phone_number_id}`, {
        headers: { Authorization: `Bearer ${waConfig.access_token}` },
      });
      const raw = await resp.json().catch(() => null);
      if (!resp.ok) return { ok: false, error: raw?.error?.message || `HTTP ${resp.status}`, raw };
      return { ok: true, raw };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

const providers: MessageProvider[] = [new MetaCloudProvider()];

export const PROVIDER_IDS = providers.map((p) => p.id);

export const DEFAULT_CONFIG: ProviderConfig = {
  provider: "meta",
  provider_url: "https://graph.facebook.com/v20.0",
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

export async function loadConfig(): Promise<ProviderConfig> {
  const waConfig = await loadWhatsAppConfig();
  return {
    ...DEFAULT_CONFIG,
    provider: "meta",
    provider_token: waConfig.access_token,
    provider_phone_number_id: waConfig.phone_number_id,
    remetente: waConfig.phone_number_id,
    webhook_secret: waConfig.verify_token,
  };
}

export function pickProvider(channel: OutboundChannel, _cfg: ProviderConfig): MessageProvider {
  const match = providers.find((p) => p.supports(channel));
  if (!match) throw new Error(`Nenhum provider disponível para canal ${channel}`);
  return match;
}
