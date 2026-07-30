export const CLINIC_WHATSAPP_NUMBER = "5582998343617";

/** Sanitiza telefone para o formato numérico do WhatsApp no padrão internacional E.164 (ex: 5582998343617) */
export function sanitizePhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/**
 * Gera a URL oficial no formato https://wa.me/<telefone>?text=<mensagem_codificada>
 * Suporta redirecionamento automático para app nativo no Celular (Android/iOS)
 * e para WhatsApp Web/Desktop no Computador.
 */
export function getWhatsAppUrl(phone?: string | null, message?: string): string {
  const cleanPhone = sanitizePhone(phone);
  const encodedMsg = message ? encodeURIComponent(message) : "";
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodedMsg}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}

/**
 * Abre o link do WhatsApp utilizando window.open(url, "_blank", "noopener,noreferrer")
 */
export function openWhatsAppLink(url: string) {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export type SolicitacaoWhatsAppInfo = {
  pacienteNome: string;
  pacienteTelefone: string;
  profissionalNome: string;
  especialidadeNome: string;
  data: string;
  horario: string;
  formaPagamento?: string;
};

/** Formata mensagem da nova solicitação enviada pelo paciente para o WhatsApp da Clínica */
export function formatClinicNotificationMsg(info: SolicitacaoWhatsAppInfo): string {
  const dataFmt = formatDateBR(info.data);
  const formaStr = info.formaPagamento ? `\n\n*Forma de Pagamento:*\n${info.formaPagamento}` : "";

  return `*NOVA SOLICITAÇÃO DE AGENDAMENTO*

*Paciente:*
${info.pacienteNome}

*Telefone:*
${info.pacienteTelefone || "Não informado"}

*Profissional:*
${info.profissionalNome}

*Especialidade:*
${info.especialidadeNome}

*Data:*
${dataFmt}

*Horário:*
${info.horario}${formaStr}`;
}

/** Gera URL do WhatsApp com a notificação pronta para o número oficial da clínica (5582998343617) */
export function getClinicWhatsAppNotificationUrl(info: SolicitacaoWhatsAppInfo): string {
  const msg = formatClinicNotificationMsg(info);
  return getWhatsAppUrl(CLINIC_WHATSAPP_NUMBER, msg);
}

/** Formata mensagem de confirmação de consulta para o paciente */
export function formatPatientConfirmationMsg(info: SolicitacaoWhatsAppInfo): string {
  const dataFmt = formatDateBR(info.data);
  const formaStr = info.formaPagamento ? `\n*Forma de Pagamento:* ${info.formaPagamento}` : "";

  return `Olá, ${info.pacienteNome}!

Sua consulta foi confirmada.

*Data:* ${dataFmt}
*Horário:* ${info.horario}
*Profissional:* ${info.profissionalNome}${formaStr}

Em caso de dúvidas estamos à disposição.

Clínica Zoe`;
}

function formatDateBR(isoData: string): string {
  if (!isoData) return "";
  if (isoData.includes("/")) return isoData;
  const parts = isoData.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoData;
}
