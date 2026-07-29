/**
 * Meta WhatsApp Cloud API - Templates & Message Formatters
 * Formatações oficiais de mensagens de WhatsApp para o sistema Clínica Zoe.
 */

export interface AppointmentData {
  pacienteNome: string;
  pacienteTelefone?: string;
  especialidade: string;
  profissional: string;
  data: string;
  hora: string;
  valor?: string | number;
  formaPagamento?: string;
  observacoes?: string;
  endereco?: string;
}

/**
 * Mensagem enviada para o cliente quando realiza um agendamento.
 */
export function buildClientAppointmentRequestMessage(data: AppointmentData): string {
  return `Olá, ${data.pacienteNome}.

Recebemos sua solicitação de consulta.

Especialidade:
${data.especialidade}

Profissional:
${data.profissional}

Data:
${data.data}

Horário:
${data.hora}

Em breve confirmaremos seu atendimento.

Clínica Zoe`;
}

/**
 * Mensagem enviada para o profissional responsável.
 */
export function buildProfessionalNotificationMessage(data: AppointmentData): string {
  const valorFmt = typeof data.valor === "number"
    ? data.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : data.valor || "A definir";

  return `Novo agendamento solicitado.

Paciente:
${data.pacienteNome}

Telefone:
${data.pacienteTelefone || "Não informado"}

Especialidade:
${data.especialidade}

Data:
${data.data}

Horário:
${data.hora}

Valor:
${valorFmt}

Forma de pagamento:
${data.formaPagamento || "Não informada"}

Observações:
${data.observacoes || "Nenhuma"}

Responda:
CONFIRMAR - para aprovar
RECUSAR - para rejeitar`;
}

/**
 * Mensagem enviada ao cliente quando a consulta é aprovada.
 */
export function buildAppointmentConfirmationMessage(data: AppointmentData): string {
  return `Sua consulta foi confirmada.

Olá, ${data.pacienteNome}.

Especialidade:
${data.especialidade}

Profissional:
${data.profissional}

Data:
${data.data}

Horário:
${data.hora}

${data.endereco ? `Endereço:\n${data.endereco}\n\n` : ""}Aguardamos você!
Clínica Zoe`;
}

/**
 * Mensagem enviada ao cliente quando a consulta é recusada.
 */
export function buildAppointmentRejectionMessage(data: AppointmentData): string {
  return `Infelizmente o horário solicitado não está disponível.

Olá, ${data.pacienteNome}.

Especialidade:
${data.especialidade}

Data solicitada:
${data.data} às ${data.hora}

Acesse nossa plataforma para escolher outro horário.

Clínica Zoe`;
}

/**
 * Mensagem enviada ao cliente quando a consulta é cancelada.
 */
export function buildAppointmentCancellationMessage(data: AppointmentData & { motivo?: string }): string {
  return `Olá, ${data.pacienteNome}.

Sua consulta agendada para ${data.data} às ${data.hora} com ${data.profissional} foi cancelada.
${data.motivo ? `\nMotivo: ${data.motivo}` : ""}

Caso precise agendar um novo atendimento, acesse a plataforma da Clínica Zoe.`;
}

/**
 * Mensagem enviada ao cliente quando a data/hora da consulta é alterada.
 */
export function buildAppointmentRescheduledMessage(data: AppointmentData): string {
  return `Olá, ${data.pacienteNome}.

Seu agendamento foi remarcado com sucesso.

Especialidade:
${data.especialidade}

Profissional:
${data.profissional}

Nova Data:
${data.data}

Novo Horário:
${data.hora}

Clínica Zoe`;
}

/**
 * Notificação enviada para administradores da clínica.
 */
export function buildAdminNotificationMessage(title: string, details: string): string {
  return `Notificação Administrativa - Clínica Zoe

${title}

${details}

Data/Hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
}
