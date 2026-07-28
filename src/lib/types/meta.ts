/**
 * Meta WhatsApp Cloud API Type Definitions
 * Based on Meta Graph API v20.0+
 */

export interface MetaCloudConfig {
  id?: string;
  access_token: string;
  phone_number_id: string;
  business_account_id: string;
  app_id: string;
  app_secret: string;
  verify_token: string;
  graph_version: string;
  created_at?: string;
  updated_at?: string;
}

export interface MetaApiStatus {
  online: boolean;
  tokenValid: boolean;
  phoneNumberConnected: boolean;
  webhookConnected: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  businessName?: string;
  qualityRating?: string;
  graphVersion: string;
  latencyMs?: number;
  lastSync?: string;
  error?: string;
}

export interface MetaWebhookInfo {
  status: "CONFIGURADO" | "PENDENTE" | "INVALIDO";
  url: string;
  verifyToken: string;
  error?: string;
}

export interface MetaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  text?: string;
  format?: "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
  buttons?: Array<{ type: string; text: string }>;
}

export interface MetaTemplate {
  id?: string;
  name: string;
  language: string;
  category?: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  status: "APPROVED" | "PENDING" | "REJECTED";
  components?: MetaTemplateComponent[];
}

export interface MetaSendMessagePayload {
  to: string;
  type: "text" | "template" | "image" | "document";
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  components?: any[];
  mediaUrl?: string;
}

export interface MetaMessageLog {
  id: string;
  agendamento_id?: string | null;
  destinatario_telefone: string;
  paciente_nome?: string | null;
  profissional_nome?: string | null;
  mensagem: string;
  mensagem_recebida?: string | null;
  template_name?: string | null;
  status_envio: "PENDENTE" | "ENVIADA" | "ENTREGUE" | "LIDO" | "RESPONDIDO" | "ERRO" | "CANCELADA";
  wamid?: string | null;
  duracao_ms?: number | null;
  ultimo_erro?: string | null;
  payload?: any;
  created_at: string;
}

export interface MetaMetrics {
  total: number;
  enviadas: number;
  entregues: number;
  lidas: number;
  recebidas: number;
  falhas: number;
  tempoMedioMs: number;
  ultimoEnvio: string | null;
}
