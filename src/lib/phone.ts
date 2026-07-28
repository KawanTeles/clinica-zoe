/**
 * Normalização de números de WhatsApp.
 * Mantém o mesmo algoritmo da função `public.normalizar_whatsapp` no banco,
 * para que cadastro e edição no frontend já gravem no formato final.
 *
 * (82) 99999-9999 -> 5582999999999
 */
export function normalizarWhatsapp(valor?: string | null): string | null {
  if (!valor) return null;
  let d = valor.replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

/** Exibição amigável de um número já normalizado: 5582999999999 -> +55 (82) 99999-9999 */
export function formatarWhatsapp(valor?: string | null): string {
  const d = normalizarWhatsapp(valor);
  if (!d) return "";
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
    const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
    return `+55 (${ddd}) ${meio}-${fim}`;
  }
  return `+${d}`;
}
