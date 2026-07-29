/**
 * Meta WhatsApp Cloud API - Phone Number Validator & Formatter
 * Responsável por sanitização, validação de DDI/DDD e conversão para E.164 (ex: 5582999999999).
 */

export interface PhoneValidationResult {
  valid: boolean;
  formattedPhone: string;
  ddi: string;
  ddd: string;
  number: string;
  error?: string;
}

/**
 * Sanitiza e valida números de telefone para envio de WhatsApp.
 * Converte automaticamente formatos com +, (), -, espaços para o padrão: 5582999999999
 */
export function validateAndFormatPhone(rawPhone: string | null | undefined): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== "string") {
    return {
      valid: false,
      formattedPhone: "",
      ddi: "",
      ddd: "",
      number: "",
      error: "Número de telefone ausente ou nulo",
    };
  }

  // 1. Remove tudo que não for dígito
  let cleanDigits = rawPhone.replace(/\D/g, "");

  if (!cleanDigits) {
    return {
      valid: false,
      formattedPhone: "",
      ddi: "",
      ddd: "",
      number: "",
      error: "Número de telefone não contém dígitos numéricos",
    };
  }

  // 2. Ajuste automático de DDI do Brasil (55) caso não informado
  // Se o número tiver 10 ou 11 dígitos (ex: 82999999999 ou 11988887777), adiciona DDI 55
  if (cleanDigits.length === 10 || cleanDigits.length === 11) {
    cleanDigits = `55${cleanDigits}`;
  }

  // 3. Validação de comprimento total para números do Brasil (12 ou 13 dígitos com DDI 55)
  if (cleanDigits.startsWith("55")) {
    if (cleanDigits.length < 12 || cleanDigits.length > 13) {
      return {
        valid: false,
        formattedPhone: cleanDigits,
        ddi: "55",
        ddd: "",
        number: "",
        error: `Comprimento inválido para número do Brasil (${cleanDigits.length} dígitos). Esperado: 12 ou 13 dígitos com DDI 55. Exemplo válido: 5582999999999`,
      };
    }

    const ddd = cleanDigits.substring(2, 4);
    const dddNum = parseInt(ddd, 10);
    if (isNaN(dddNum) || dddNum < 11 || dddNum > 99) {
      return {
        valid: false,
        formattedPhone: cleanDigits,
        ddi: "55",
        ddd,
        number: cleanDigits.substring(4),
        error: `DDD '${ddd}' é inválido no Brasil. DDDs válidos variam entre 11 e 99.`,
      };
    }

    return {
      valid: true,
      formattedPhone: cleanDigits,
      ddi: "55",
      ddd,
      number: cleanDigits.substring(4),
    };
  }

  // 4. Números internacionais fora do Brasil (comprimento entre 10 e 15 dígitos)
  if (cleanDigits.length >= 10 && cleanDigits.length <= 15) {
    return {
      valid: true,
      formattedPhone: cleanDigits,
      ddi: cleanDigits.substring(0, 2),
      ddd: cleanDigits.substring(2, 4),
      number: cleanDigits.substring(4),
    };
  }

  return {
    valid: false,
    formattedPhone: cleanDigits,
    ddi: "",
    ddd: "",
    number: "",
    error: `Comprimento do telefone inválido (${cleanDigits.length} dígitos). Deve possuir entre 10 e 15 dígitos numéricos.`,
  };
}
