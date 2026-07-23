import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "ADMIN")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Somente administradores podem executar esta ação");
}

/** Processa uma notificação da fila, chamando o provider correto e atualizando o status. */
async function processOne(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { pickProvider } = await import("@/lib/notifications/provider.server");

  const { data: n, error } = await supabaseAdmin
    .from("notificacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !n) return { ok: false, error: "Notificação não encontrada" };

  if (n.canal === "INTERNO") {
    await supabaseAdmin
      .from("notificacoes")
      .update({ status_envio: "ENVIADA", enviado_em: new Date().toISOString() })
      .eq("id", id);
    return { ok: true };
  }

  const to = n.canal === "WHATSAPP" ? n.destinatario_telefone : n.destinatario_email;
  if (!to) {
    await supabaseAdmin
      .from("notificacoes")
      .update({ status_envio: "ERRO", ultimo_erro: "Destinatário sem contato", tentativas: (n.tentativas ?? 0) + 1 })
      .eq("id", id);
    return { ok: false, error: "Destinatário sem contato" };
  }

  await supabaseAdmin.from("notificacoes").update({ status_envio: "ENVIANDO" }).eq("id", id);

  const provider = pickProvider(n.canal as "WHATSAPP" | "EMAIL");
  const result = await provider.send({
    channel: n.canal as "WHATSAPP" | "EMAIL",
    to,
    title: n.titulo,
    body: n.mensagem,
    metadata: { notificacao_id: n.id, agendamento_id: n.agendamento_id },
  });

  await supabaseAdmin
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

  return result;
}

export const reenviarNotificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const r = await processOne(data.id);
    return { ok: r.ok, error: r.error, providerId: r.providerId };
  });

export const processarFilaNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number }) => z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pend, error } = await supabaseAdmin
      .from("notificacoes")
      .select("id")
      .eq("status_envio", "PENDENTE")
      .in("canal", ["WHATSAPP", "EMAIL"])
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const results: Array<{ id: string; ok: boolean; error?: string; providerId?: string }> = [];
    for (const row of pend ?? []) {
      const r = await processOne(row.id);
      results.push({ id: row.id, ok: r.ok, error: r.error, providerId: r.providerId });
    }
    return { processed: results.length, results };
  });

export const cancelarNotificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notificacoes")
      .update({ status_envio: "CANCELADA" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
