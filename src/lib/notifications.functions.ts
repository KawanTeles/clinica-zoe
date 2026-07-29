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

export const reenviarNotificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { processOne } = await import("@/lib/notifications/queue.server");
    const r = await processOne(data.id, { ignorarJanela: true });
    return { ok: r.ok, error: r.error, providerId: r.providerId };
  });

export const processarFilaNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { processQueue } = await import("@/lib/notifications/queue.server");
    return await processQueue(data.limit, { ignorarJanela: true });
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

/** Gera manualmente os lembretes pendentes (24h/2h). */
export const gerarLembretesAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { gerarLembretes } = await import("@/lib/notifications/queue.server");
    return { criados: await gerarLembretes() };
  });

/** Reenvia em massa todas as notificações externas com erro. */
export const reenviarErros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { reprocessarErros } = await import("@/lib/notifications/queue.server");
    return await reprocessarErros(100);
  });

/** Configuração de notificações — o token nunca é devolvido, apenas se está definido. */
export const obterConfigNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadConfig } = await import("@/lib/notifications/provider.server");
    const cfg = await loadConfig();
    return {
      destinatario_solicitacao: cfg.destinatario_solicitacao,
      lembrete_24h_ativo: cfg.lembrete_24h_ativo,
      lembrete_2h_ativo: cfg.lembrete_2h_ativo,
      provider: cfg.provider,
      provider_url: cfg.provider_url ?? "",
      remetente: cfg.remetente ?? "",
      provider_instancia: cfg.provider_instancia ?? "",
      webhook_secret: cfg.webhook_secret ?? "",
      token_definido: !!cfg.provider_token,
      conexao_status: cfg.conexao_status,
      conexao_testada_em: cfg.conexao_testada_em,
      conexao_erro: cfg.conexao_erro,
      janela_ativa: cfg.janela_ativa,
      janela_inicio: (cfg.janela_inicio ?? "08:00").slice(0, 5),
      janela_fim: (cfg.janela_fim ?? "20:00").slice(0, 5),
      templates: cfg.templates ?? {},
    };
  });

const configSchema = z.object({
  destinatario_solicitacao: z.enum(["PROFISSIONAL", "RECEPCIONISTA", "AMBOS", "ADMINISTRADOR", "TODOS"]),
  lembrete_24h_ativo: z.boolean(),
  lembrete_2h_ativo: z.boolean(),
  provider: z.enum(["console", "evolution", "meta", "twilio"]),
  provider_url: z.string().max(500).optional().default(""),
  remetente: z.string().max(120).optional().default(""),
  provider_instancia: z.string().max(200).optional().default(""),
  webhook_secret: z.string().max(500).optional().default(""),
  /** Enviado apenas quando o admin digita um novo token. */
  provider_token: z.string().max(2000).optional(),
  janela_ativa: z.boolean().optional().default(true),
  janela_inicio: z.string().regex(/^\d{2}:\d{2}$/).optional().default("08:00"),
  janela_fim: z.string().regex(/^\d{2}:\d{2}$/).optional().default("20:00"),
  templates: z.record(z.string(), z.string().max(2000)).optional().default({}),
});

export const salvarConfigNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => configSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: Record<string, unknown> = {
      destinatario_solicitacao: data.destinatario_solicitacao,
      lembrete_24h_ativo: data.lembrete_24h_ativo,
      lembrete_2h_ativo: data.lembrete_2h_ativo,
      provider: data.provider,
      provider_url: data.provider_url || null,
      remetente: data.remetente || null,
      provider_instancia: data.provider_instancia || null,
      webhook_secret: data.webhook_secret || null,
      janela_ativa: data.janela_ativa,
      janela_inicio: data.janela_inicio,
      janela_fim: data.janela_fim,
      templates: data.templates,
    };
    if (data.provider_token) payload.provider_token = data.provider_token;


    const { data: existing } = await (supabaseAdmin as any)
      .from("notificacoes_config")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await (supabaseAdmin as any)
        .from("notificacoes_config")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabaseAdmin as any)
        .from("notificacoes_config")
        .insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const testarConexaoNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadConfig, pickProvider } = await import("@/lib/notifications/provider.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cfg = await loadConfig();
    const provider = pickProvider("WHATSAPP", cfg);
    const r = await provider.test(cfg);

    const { data: existing } = await (supabaseAdmin as any)
      .from("notificacoes_config")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      await (supabaseAdmin as any)
        .from("notificacoes_config")
        .update({
          conexao_status: r.ok ? "CONECTADO" : "ERRO",
          conexao_testada_em: new Date().toISOString(),
          conexao_erro: r.ok ? null : (r.error ?? "Falha desconhecida"),
        })
        .eq("id", existing.id);
    }

    return { ok: r.ok, error: r.error, provider: provider.id };
  });

/**
 * Envia imediatamente as notificações externas pendentes de um agendamento,
 * sem esperar a rotina agendada. Qualquer usuário autenticado envolvido no
 * fluxo pode acionar, mas apenas para o agendamento informado.
 */
export const dispararNotificacoesAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agendamentoId: string }) =>
    z.object({ agendamentoId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processOne } = await import("@/lib/notifications/queue.server");

    const { data: pend, error } = await (supabaseAdmin as any)
      .from("notificacoes")
      .select("id")
      .eq("agendamento_id", data.agendamentoId)
      .in("status_envio", ["PENDENTE", "ERRO"])

      .in("canal", ["WHATSAPP", "EMAIL"])
      .limit(20);
    if (error) throw new Error(error.message);

    let enviados = 0;
    for (const row of pend ?? []) {
      const r = await processOne(row.id);
      if (r.ok) enviados += 1;
    }
    return { enviados, total: pend?.length ?? 0 };
  });
