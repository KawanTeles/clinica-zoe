/**
 * Motor de variáveis dos templates de WhatsApp.
 * Suporta placeholders nomeados ({{PACIENTE}}) e posicionais ({{1}}).
 */

export const VARIAVEIS_DISPONIVEIS = [
  "PACIENTE",
  "PROFISSIONAL",
  "ESPECIALIDADE",
  "DATA",
  "HORARIO",
  "VALOR",
  "CLINICA",
  "ENDERECO",
  "TELEFONE",
  "LINK",
] as const;

export type VariavelWhatsApp = (typeof VARIAVEIS_DISPONIVEIS)[number];

export type VariableValues = Record<string, string | number | null | undefined>;

/** Lista todos os placeholders presentes no texto, na ordem de aparição (sem duplicar). */
export function extractPlaceholders(text: string): string[] {
  const found: string[] = [];
  const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

/** Converte um corpo com variáveis nomeadas em corpo posicional ({{1}}, {{2}}...) para a Meta. */
export function toPositionalBody(text: string): { body: string; ordem: string[] } {
  const ordem = extractPlaceholders(text).filter((p) => !/^\d+$/.test(p));
  let body = text;
  ordem.forEach((nome, i) => {
    body = body.replace(new RegExp(`\\{\\{\\s*${nome}\\s*\\}\\}`, "g"), `{{${i + 1}}}`);
  });
  return { body, ordem };
}

/**
 * Substitui as variáveis do texto e informa quais ficaram sem valor.
 * Nada é enviado com placeholder pendente — o chamador deve validar `faltando`.
 */
export function renderVariables(
  text: string,
  values: VariableValues,
): { texto: string; faltando: string[] } {
  const faltando: string[] = [];
  const texto = text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_all, nome: string) => {
    const raw = values[nome] ?? values[nome.toUpperCase()];
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      if (!faltando.includes(nome)) faltando.push(nome);
      return `{{${nome}}}`;
    }
    return String(raw);
  });
  return { texto, faltando };
}

/** Monta os components de BODY de um template da Meta a partir da ordem de variáveis. */
export function buildTemplateComponents(
  ordem: string[],
  values: VariableValues,
): { components: any[]; faltando: string[] } {
  const faltando: string[] = [];
  const parameters = ordem.map((nome) => {
    const raw = values[nome] ?? values[nome.toUpperCase()];
    if (raw === undefined || raw === null || String(raw).trim() === "") faltando.push(nome);
    return { type: "text", text: raw === undefined || raw === null ? "" : String(raw) };
  });

  if (parameters.length === 0) return { components: [], faltando };
  return { components: [{ type: "body", parameters }], faltando };
}
