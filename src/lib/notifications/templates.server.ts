/**
 * Templates editáveis das mensagens externas. Server-only.
 * Os textos ficam em `notificacoes_config.templates` (jsonb) e aceitam
 * variáveis: {nome} {profissional} {especialidade} {data} {hora} {endereco} {valor} {clinica}
 */

export const TEMPLATE_EVENTOS = [
  "SOLICITACAO_NOVA",
  "CONSULTA_APROVADA",
  "CONSULTA_RECUSADA",
  "CONSULTA_CANCELADA",
  "CONSULTA_REMARCADA",
  "LEMBRETE_24H",
  "LEMBRETE_2H",
  "PAGAMENTO_CONFIRMADO",
] as const;

export type TemplateEvento = (typeof TEMPLATE_EVENTOS)[number];

export const TEMPLATE_LABEL: Record<TemplateEvento, string> = {
  SOLICITACAO_NOVA: "Nova solicitação",
  CONSULTA_APROVADA: "Consulta confirmada",
  CONSULTA_RECUSADA: "Consulta recusada",
  CONSULTA_CANCELADA: "Consulta cancelada",
  CONSULTA_REMARCADA: "Consulta remarcada",
  LEMBRETE_24H: "Lembrete 24h",
  LEMBRETE_2H: "Lembrete 2h",
  PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
};

export const TEMPLATE_VARS = [
  "{nome}",
  "{profissional}",
  "{especialidade}",
  "{data}",
  "{hora}",
  "{endereco}",
  "{valor}",
  "{clinica}",
] as const;

/** Vazio = usa o texto padrão gerado pelo sistema. */
export const DEFAULT_TEMPLATES: Record<TemplateEvento, string> = {
  SOLICITACAO_NOVA: "",
  CONSULTA_APROVADA:
    "Olá, {nome}.\n\nSua consulta foi CONFIRMADA.\n\nProfissional: {profissional}\nEspecialidade: {especialidade}\nData: {data}\nHorário: {hora}\nEndereço: {endereco}\n\nCaso precise remarcar ou cancelar, acesse sua Área do Paciente.",
  CONSULTA_RECUSADA:
    "Olá, {nome}.\n\nInfelizmente sua solicitação para {data} às {hora} não pôde ser aprovada.\n\nAcesse sua Área do Paciente para escolher outro horário.",
  CONSULTA_CANCELADA:
    "Olá, {nome}.\n\nSua consulta foi CANCELADA.\n\nProfissional: {profissional}\nData: {data}\nHorário: {hora}\n\nPara agendar novamente, acesse sua Área do Paciente.",
  CONSULTA_REMARCADA:
    "Olá, {nome}.\n\nSua consulta foi REMARCADA.\n\nProfissional: {profissional}\nEspecialidade: {especialidade}\nNova data: {data}\nNovo horário: {hora}\nEndereço: {endereco}",
  LEMBRETE_24H:
    "Olá, {nome}.\n\nEste é um lembrete da sua consulta.\n\nData: {data}\nHorário: {hora}\nProfissional: {profissional}\nEndereço: {endereco}\n\nCaso não possa comparecer, acesse sua Área do Paciente.",
  LEMBRETE_2H:
    "Olá, {nome}.\n\nSua consulta começa em breve.\n\nData: {data}\nHorário: {hora}\nProfissional: {profissional}\nEndereço: {endereco}",
  PAGAMENTO_CONFIRMADO:
    "Olá, {nome}.\n\nPagamento confirmado no valor de R$ {valor}.\n\nObrigado pela confiança.",
};

export function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

/** Variáveis a partir de um agendamento (service role). */
export async function buildVars(agendamentoId: string | null): Promise<Record<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const base: Record<string, string> = {
    nome: "paciente",
    profissional: "—",
    especialidade: "—",
    data: "—",
    hora: "—",
    endereco: "consulte a clínica",
    valor: "0,00",
    clinica: "Clínica Zoe",
  };

  const { data: clinica } = await (supabaseAdmin as any)
    .from("configuracoes_clinica")
    .select("nome, endereco")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (clinica?.endereco) base.endereco = clinica.endereco;
  if (clinica?.nome) base.clinica = clinica.nome;

  if (!agendamentoId) return base;

  const { data: a } = await (supabaseAdmin as any)
    .from("agendamentos")
    .select(
      "data, hora_inicio, valor, pacientes(nome), profissionais(nome, especialidades(nome))",
    )
    .eq("id", agendamentoId)
    .maybeSingle();
  if (!a) return base;

  const [y, m, d] = String(a.data).split("-");
  base.data = `${d}/${m}/${y}`;
  base.hora = String(a.hora_inicio).slice(0, 5);
  base.nome = a.pacientes?.nome ?? base.nome;
  base.profissional = a.profissionais?.nome ?? base.profissional;
  base.especialidade = a.profissionais?.especialidades?.nome ?? base.especialidade;
  base.valor = Number(a.valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return base;
}
