/**
 * Meta WhatsApp Cloud API - Error Handler & Diagnostics
 * Mapeamento completo de códigos de erro da Meta Graph API (v20.0+) com tratamento
 * amigável para UI e diagnósticos técnicos detalhados.
 */

export interface MetaParsedError {
  code: number | string;
  subcode?: number;
  type: string;
  userMessage: string;
  technicalDiagnostic: string;
  isDevelopmentModeError: boolean;
  isAllowedListError: boolean;
  isTokenExpired: boolean;
  retryable: boolean;
  actionRequired?: string;
  rawError?: any;
}

/**
 * Analisa e classifica erros retornados pela Meta WhatsApp Cloud API.
 */
export function parseMetaApiError(rawResponse: any, httpStatus: number): MetaParsedError {
  const metaErr = rawResponse?.error;
  const code = metaErr?.code ?? httpStatus;
  const subcode = metaErr?.error_subcode;
  const message = metaErr?.message || rawResponse?.message || `Erro HTTP ${httpStatus}`;
  const errorType = metaErr?.type || "OAuthException";

  // Default Structure
  const parsed: MetaParsedError = {
    code,
    subcode,
    type: errorType,
    userMessage: message,
    technicalDiagnostic: `[Meta Cloud API Error ${code}] HTTP ${httpStatus}: ${message}`,
    isDevelopmentModeError: false,
    isAllowedListError: false,
    isTokenExpired: false,
    retryable: false,
    rawError: rawResponse,
  };

  // Mapeamento específico por código de erro da Meta
  switch (Number(code)) {
    case 131030:
      parsed.isDevelopmentModeError = true;
      parsed.isAllowedListError = true;
      parsed.userMessage = "O aplicativo da Meta está em modo Development. Apenas números cadastrados na Allowed List podem receber mensagens.";
      parsed.technicalDiagnostic = "Erro 131030: O número de destino não está cadastrado na Allowed List de destinatários autorizados no painel Meta for Developers (Sandbox/Dev Mode).";
      parsed.actionRequired = "Acesse o Meta Developers Console (WhatsApp > API Setup > To) e adicione o número de telefone do destinatário à lista de teste, ou migre o app para o modo Live/Produção.";
      parsed.retryable = false;
      break;

    case 131026:
      parsed.userMessage = "A mensagem não pôde ser entregue. O número informado não possui uma conta ativa no WhatsApp.";
      parsed.technicalDiagnostic = "Erro 131026: Mensagem não entregue. O destinatário não possui WhatsApp ativo ou bloqueou a conta comercial.";
      parsed.actionRequired = "Verifique se o número do cliente possui WhatsApp ativo.";
      parsed.retryable = false;
      break;

    case 131021:
      parsed.userMessage = "O número remetente e o destinatário não podem ser idênticos.";
      parsed.technicalDiagnostic = "Erro 131021: O Phone Number ID remetente é o mesmo número do destinatário.";
      parsed.actionRequired = "Utilize um número de telefone diferente para o teste.";
      parsed.retryable = false;
      break;

    case 131047:
    case 131048:
      parsed.userMessage = "Limite de taxa (Rate Limit) da Meta excedido. A tentativa será refeita automaticamente em instantes.";
      parsed.technicalDiagnostic = `Erro ${code}: Limite de envio de mensagens por segundo excedido na Meta Cloud API.`;
      parsed.actionRequired = "Aguardando janela de envio e efetuando retry automático.";
      parsed.retryable = true;
      break;

    case 100:
      parsed.userMessage = "Parâmetros da mensagem inválidos ou estrutura JSON malformatada.";
      parsed.technicalDiagnostic = `Erro 100: Invalid parameter - ${message}`;
      parsed.actionRequired = "Verifique o formato da mensagem ou os componentes do template enviado.";
      parsed.retryable = false;
      break;

    case 190:
      parsed.isTokenExpired = true;
      parsed.userMessage = "Token de Acesso da Meta expirado ou revogado. Atualize as credenciais no painel de configurações.";
      parsed.technicalDiagnostic = "Erro 190: Access Token inválido ou expirado (OAuthException).";
      parsed.actionRequired = "Gere um novo Permanent System User Access Token no Meta Business Manager e salve em Configurações > WhatsApp.";
      parsed.retryable = false;
      break;

    case 200:
      parsed.userMessage = "Permissões insuficientes na Meta API para enviar mensagens.";
      parsed.technicalDiagnostic = "Erro 200: Permissão ausente. Escopo 'whatsapp_business_messaging' necessário no token.";
      parsed.actionRequired = "Adicione a permissão 'whatsapp_business_messaging' ao System User Token na Meta.";
      parsed.retryable = false;
      break;

    case 401:
      parsed.isTokenExpired = true;
      parsed.userMessage = "Erro de Autenticação (HTTP 401): Access Token não informado ou inválido.";
      parsed.technicalDiagnostic = "HTTP 401 Unauthorized: Bearer Token rejeitado pela Meta Graph API.";
      parsed.actionRequired = "Confira se a variável WHATSAPP_ACCESS_TOKEN no .env possui o token correto.";
      parsed.retryable = false;
      break;

    case 403:
      parsed.userMessage = "Acesso proibido (HTTP 403). Verifique as permissões da conta de negócios da Meta.";
      parsed.technicalDiagnostic = "HTTP 403 Forbidden: Conta comercial sem acesso ao recurso solicitado.";
      parsed.actionRequired = "Verifique a verificação da empresa (Business Verification) no Meta Business Suite.";
      parsed.retryable = false;
      break;

    case 404:
      parsed.userMessage = "Phone Number ID da Meta não encontrado (HTTP 404).";
      parsed.technicalDiagnostic = "HTTP 404 Not Found: O Phone Number ID configurado não existe na Meta Graph API.";
      parsed.actionRequired = "Confira o Phone Number ID informado no painel ou no arquivo .env.";
      parsed.retryable = false;
      break;

    case 429:
      parsed.userMessage = "Muitas requisições enviadas à Meta (HTTP 429). Retentando automaticamente...";
      parsed.technicalDiagnostic = "HTTP 429 Too Many Requests: Rate limit ativado pela Meta.";
      parsed.actionRequired = "O sistema efetuará o retry com backoff exponencial.";
      parsed.retryable = true;
      break;

    case 500:
    case 503:
      parsed.userMessage = "Indisponibilidade temporária nos servidores da Meta. Retentando envio...";
      parsed.technicalDiagnostic = `HTTP ${code} Meta Server Error: Falha interna temporária na infraestrutura da Meta.`;
      parsed.actionRequired = "O sistema efetuará o retry com backoff exponencial.";
      parsed.retryable = true;
      break;

    default:
      if (message.toLowerCase().includes("allowed list") || message.toLowerCase().includes("test number")) {
        parsed.isDevelopmentModeError = true;
        parsed.isAllowedListError = true;
        parsed.userMessage = "O aplicativo da Meta está em modo Development. Apenas números cadastrados na Allowed List podem receber mensagens.";
        parsed.actionRequired = "Adicione o número à Allowed List de teste na Meta.";
        parsed.retryable = false;
      }
      break;
  }

  return parsed;
}
