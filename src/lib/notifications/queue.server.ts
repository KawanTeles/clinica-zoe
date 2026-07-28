/**
 * Processamento da fila de notificações. Server-only.
 */
import type { ProviderConfig } from "./provider.server";

export type ProcessResult = {
  ok: boolean;
  error?: string;
  providerId?: string;
  adiada?: boolean;
  definitivo?: boolean;
};

/**
 * Política de reenvio automático: 1ª tentativa → +2 min → 2ª → +5 min → 3ª →
 * +15 min → 4ª falha marca ERRO DEFINITIVO.
 */
export const RETRY_DELAYS_MIN = [2, 5, 15] as const;

/** Minutos até a próxima tentativa, ou null quando o erro é definitivo. */
export function proximoIntervaloMin(tentativas: number): number | null {
  return RETRY_DELAYS_MIN[tentativas - 1] ?? null;
}

/** Hora atual (HH:MM) no fuso da clínica. */
function horaLocal(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Verifica se o horário atual está dentro da janela configurada. */
export function dentroDaJanela(cfg: ProviderConfig): boolean {
  if (!cfg.janela_ativa) return true;
  const ini = (cfg.janela_inicio ?? "00:00").slice(0, 5);
  const fim = (cfg.janela_fim ?? "23:59").slice(0, 5);
  const agora = horaLocal();
  if (ini === fim) return true;
  return ini < fim ? agora >= ini && agora <= fim : agora >= ini || agora <= fim;
}


export async function processOne(id: string, opts?: { ignorarJanela?: boolean }): Promise<ProcessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { pickProvider, loadConfig } = await import("./provider.server");
  const { DEFAULT_TEMPLATES, renderTemplate, buildVars } = await import("./templates.server");

  const { data: n, error } = await (supabaseAdmin as any)
    .from("notificacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !n) return { ok: false, error: "Notificação não encontrada" };

  if (n.canal === "INTERNO") {
    await (supabaseAdmin as any)
      .from("notificacoes")
      .update({ status_envio: "ENVIADA", enviado_em: new Date().toISOString() })
      .eq("id", id);
    return { ok: true };
  }

  const to = n.canal === "WHATSAPP" ? n.destinatario_telefone : n.destinatario_email;
  if (!to) {
    await (supabaseAdmin as any)
      .from("notificacoes")
      .update({
        status_envio: "ERRO",
        ultimo_erro: "Destinatário sem contato",
        tentativas: (n.tentativas ?? 0) + 1,
      })
      .eq("id", id);
    return { ok: false, error: "Destinatário sem contato" };
  }

  const cfg: ProviderConfig = await loadConfig();

  if (!opts?.ignorarJanela && !dentroDaJanela(cfg)) {
    // Permanece na fila até o próximo horário permitido.
    await (supabaseAdmin as any)
      .from("notificacoes")
      .update({
        status_envio: "PENDENTE",
        ultimo_erro: `Fora da janela de envio (${cfg.janela_inicio?.slice(0, 5)}–${cfg.janela_fim?.slice(0, 5)})`,
      })
      .eq("id", id);
    return { ok: false, adiada: true, error: "Fora da janela de envio" };
  }

  await (supabaseAdmin as any)
    .from("notificacoes")
    .update({ status_envio: "ENVIANDO" })
    .eq("id", id);

  // Texto: template personalizado do evento (se houver) ou o texto original.
  let body: string = n.mensagem;
  const tpl = (cfg.templates ?? {})[n.evento as string] ?? DEFAULT_TEMPLATES[n.evento as keyof typeof DEFAULT_TEMPLATES];
  if (n.evento && tpl && (cfg.templates ?? {})[n.evento as string]) {
    const vars = await buildVars(n.agendamento_id);
    body = renderTemplate(tpl, vars);
  }

  const provider = pickProvider(n.canal as "WHATSAPP" | "EMAIL", cfg);
  const t0 = Date.now();
  const result = await provider.send(
    {
      channel: n.canal as "WHATSAPP" | "EMAIL",
      to,
      title: n.titulo,
      body,
      metadata: { notificacao_id: n.id, agendamento_id: n.agendamento_id },
    },
    cfg,
  );
  const duracao = Date.now() - t0;

  await (supabaseAdmin as any)
    .from("notificacoes")
    .update(
      result.ok
        ? {
            status_envio: "ENVIADA",
            enviado_em: new Date().toISOString(),
            tentativas: (n.tentativas ?? 0) + 1,
            ultimo_erro: null,
            provider: provider.id,
            duracao_ms: duracao,
            mensagem: body,
          }
        : {
            status_envio: "ERRO",
            tentativas: (n.tentativas ?? 0) + 1,
            ultimo_erro: result.error ?? "Falha desconhecida",
            provider: provider.id,
            duracao_ms: duracao,
          },
    )
    .eq("id", id);

  console.log(
    `[notif] ${new Date().toISOString()} id=${id} canal=${n.canal} para=${to} provider=${provider.id} ms=${duracao} status=${result.ok ? "ENVIADA" : "ERRO"}${result.ok ? "" : ` erro=${result.error}`}`,
  );

  return { ok: result.ok, error: result.error, providerId: result.providerId };
}

export async function processQueue(limit = 20, opts?: { ignorarJanela?: boolean }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pend, error } = await (supabaseAdmin as any)
    .from("notificacoes")
    .select("id")
    .eq("status_envio", "PENDENTE")
    .in("canal", ["WHATSAPP", "EMAIL"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string } & ProcessResult> = [];
  for (const row of pend ?? []) {
    const r = await processOne(row.id, opts);
    results.push({ id: row.id, ...r });
  }
  return {
    processed: results.length,
    enviadas: results.filter((r) => r.ok).length,
    adiadas: results.filter((r) => r.adiada).length,
    results,
  };
}

/** Reenvia todas as notificações externas com erro. */
export async function reprocessarErros(limit = 100) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("notificacoes")
    .select("id")
    .eq("status_envio", "ERRO")
    .in("canal", ["WHATSAPP", "EMAIL"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let enviadas = 0;
  for (const row of rows ?? []) {
    const r = await processOne(row.id, { ignorarJanela: true });
    if (r.ok) enviadas += 1;
  }
  return { total: rows?.length ?? 0, enviadas };
}

/** Gera lembretes (24h/2h) conforme a configuração e devolve quantos foram criados. */
export async function gerarLembretes(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("gerar_lembretes");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
