/**
 * Processamento da fila de notificações. Server-only.
 */
import type { ProviderConfig } from "./provider.server";

export type ProcessResult = { ok: boolean; error?: string; providerId?: string };

export async function processOne(id: string): Promise<ProcessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { pickProvider, loadConfig } = await import("./provider.server");

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

  await (supabaseAdmin as any)
    .from("notificacoes")
    .update({ status_envio: "ENVIANDO" })
    .eq("id", id);

  const cfg: ProviderConfig = await loadConfig();
  const provider = pickProvider(n.canal as "WHATSAPP" | "EMAIL", cfg);
  const result = await provider.send(
    {
      channel: n.canal as "WHATSAPP" | "EMAIL",
      to,
      title: n.titulo,
      body: n.mensagem,
      metadata: { notificacao_id: n.id, agendamento_id: n.agendamento_id },
    },
    cfg,
  );

  await (supabaseAdmin as any)
    .from("notificacoes")
    .update(
      result.ok
        ? {
            status_envio: "ENVIADA",
            enviado_em: new Date().toISOString(),
            tentativas: (n.tentativas ?? 0) + 1,
            ultimo_erro: null,
          }
        : {
            status_envio: "ERRO",
            tentativas: (n.tentativas ?? 0) + 1,
            ultimo_erro: result.error ?? "Falha desconhecida",
          },
    )
    .eq("id", id);

  return { ok: result.ok, error: result.error, providerId: result.providerId };
}

export async function processQueue(limit = 20) {
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
    const r = await processOne(row.id);
    results.push({ id: row.id, ...r });
  }
  return { processed: results.length, results };
}

/** Gera lembretes (24h/2h) conforme a configuração e devolve quantos foram criados. */
export async function gerarLembretes(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("gerar_lembretes");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
