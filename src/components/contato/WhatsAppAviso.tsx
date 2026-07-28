import { AlertTriangle, MessageSquare } from "lucide-react";

/** Verdadeiro quando o número de WhatsApp está ausente/vazio. */
export function semWhatsapp(valor?: string | null) {
  return !valor || valor.trim() === "";
}

/**
 * Aviso discreto exibido no painel quando um usuário não possui WhatsApp
 * cadastrado e, portanto, não receberá notificações automáticas.
 */
export function WhatsAppAviso({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 ${className}`}
      title="Sem WhatsApp cadastrado — este usuário não receberá notificações automáticas."
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Sem WhatsApp
    </span>
  );
}

/** Linha de contato de WhatsApp com aviso automático quando vazio. */
export function WhatsAppLinha({
  valor,
  className = "",
}: {
  valor?: string | null;
  className?: string;
}) {
  if (semWhatsapp(valor)) return <WhatsAppAviso className={className} />;
  return (
    <span className={`inline-flex items-center gap-1 text-muted-foreground ${className}`}>
      <MessageSquare className="h-3 w-3" aria-hidden />
      {valor}
    </span>
  );
}
