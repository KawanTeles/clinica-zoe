/**
 * Provider abstraction for outbound messaging (E-mail / Console).
 * Server-only. Never import from client code.
 */

export type OutboundChannel = "EMAIL";

export interface OutboundMessage {
  channel: OutboundChannel;
  to: string; // email
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

class ConsoleEmailProvider implements MessageProvider {
  id = "console";
  supports(channel: OutboundChannel) {
    return channel === "EMAIL";
  }

  async send(msg: OutboundMessage, _cfg: ProviderConfig): Promise<DeliveryResult> {
    console.log(`[Email Outbound] To: ${msg.to} Title: ${msg.title}`);
    return { ok: true, providerId: `console-${Date.now()}` };
  }

  async test(_cfg: ProviderConfig): Promise<DeliveryResult> {
    return { ok: true };
  }
}

const providers: MessageProvider[] = [new ConsoleEmailProvider()];

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
  conexao_status: "CONECTADO",
  conexao_testada_em: null,
  conexao_erro: null,
  janela_ativa: true,
  janela_inicio: "08:00",
  janela_fim: "20:00",
  templates: {},
};

export async function loadConfig(): Promise<ProviderConfig> {
  return {
    ...DEFAULT_CONFIG,
  };
}

export function pickProvider(channel: OutboundChannel, _cfg: ProviderConfig): MessageProvider {
  const match = providers.find((p) => p.supports(channel));
  if (!match) throw new Error(`Nenhum provider disponível para canal ${channel}`);
  return match;
}
