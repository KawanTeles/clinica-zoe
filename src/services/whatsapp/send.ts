/**
 * Meta WhatsApp Cloud API - Sending API
 * Funções de alto nível para envio de mensagens via Meta WhatsApp Cloud API.
 * Server-only module.
 */

import { sendRawCloudApiMessage, CloudApiSendResult } from "./cloudApi";
import {
  AppointmentData,
  buildClientAppointmentRequestMessage,
  buildProfessionalNotificationMessage,
  buildAppointmentConfirmationMessage,
  buildAppointmentRejectionMessage,
  buildAppointmentCancellationMessage,
  buildAppointmentRescheduledMessage,
  buildAdminNotificationMessage,
} from "./templates";

/**
 * Envia uma mensagem de texto simples para um número de WhatsApp.
 */
export async function sendText(
  to: string,
  message: string,
  options?: { agendamentoId?: string }
): Promise<CloudApiSendResult> {
  return sendRawCloudApiMessage(
    to,
    {
      type: "text",
      text: {
        preview_url: true,
        body: message,
      },
    },
    { agendamentoId: options?.agendamentoId }
  );
}

/**
 * Envia uma mensagem de template oficial pré-aprovado pela Meta.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string = "pt_BR",
  components: any[] = [],
  options?: { agendamentoId?: string }
): Promise<CloudApiSendResult> {
  return sendRawCloudApiMessage(
    to,
    {
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    },
    { agendamentoId: options?.agendamentoId, templateName }
  );
}

/**
 * Envia mensagem inicial ao cliente confirmando o recebimento da solicitação de agendamento.
 */
export async function sendClientAppointmentRequest(
  data: AppointmentData & { to: string; agendamentoId?: string }
): Promise<CloudApiSendResult> {
  const message = buildClientAppointmentRequestMessage(data);
  return sendText(data.to, message, { agendamentoId: data.agendamentoId });
}

/**
 * Envia notificação da confirmação da consulta para o cliente (Aprovação).
 */
export async function sendAppointmentConfirmation(
  data: AppointmentData & { to: string; agendamentoId?: string }
): Promise<CloudApiSendResult> {
  const message = buildAppointmentConfirmationMessage(data);
  return sendText(data.to, message, { agendamentoId: data.agendamentoId });
}

/**
 * Envia notificação de novo agendamento para o profissional responsável.
 */
export async function sendProfessionalNotification(
  data: AppointmentData & { to: string; agendamentoId?: string }
): Promise<CloudApiSendResult> {
  const message = buildProfessionalNotificationMessage(data);
  return sendText(data.to, message, { agendamentoId: data.agendamentoId });
}

/**
 * Envia notificação de recusa do agendamento para o cliente (Rejeição).
 */
export async function sendAppointmentRejection(
  data: AppointmentData & { to: string; agendamentoId?: string }
): Promise<CloudApiSendResult> {
  const message = buildAppointmentRejectionMessage(data);
  return sendText(data.to, message, { agendamentoId: data.agendamentoId });
}

/**
 * Envia notificação de cancelamento de consulta.
 */
export async function sendAppointmentCancellation(
  data: AppointmentData & { to: string; motivo?: string; agendamentoId?: string }
): Promise<CloudApiSendResult> {
  const message = buildAppointmentCancellationMessage(data);
  return sendText(data.to, message, { agendamentoId: data.agendamentoId });
}

/**
 * Envia notificação de remarcação de consulta (alteração de data ou horário).
 */
export async function sendAppointmentRescheduled(
  data: AppointmentData & { to: string; agendamentoId?: string }
): Promise<CloudApiSendResult> {
  const message = buildAppointmentRescheduledMessage(data);
  return sendText(data.to, message, { agendamentoId: data.agendamentoId });
}

/**
 * Envia notificação administrativa para o painel / equipe responsável.
 */
export async function sendAdminNotification(
  data: { title: string; details: string; to?: string; agendamentoId?: string }
): Promise<CloudApiSendResult> {
  const message = buildAdminNotificationMessage(data.title, data.details);
  const recipient = data.to || process.env.ADMIN_WHATSAPP_PHONE || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  if (!recipient) {
    console.warn("[whatsapp:sendAdminNotification] Nenhum telefone de admin configurado.");
    return { ok: false, duracaoMs: 0, status: 400, error: "Destinatário admin não informado" };
  }
  return sendText(recipient, message, { agendamentoId: data.agendamentoId });
}
