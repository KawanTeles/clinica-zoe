import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateMetaAuth } from "@/lib/services/meta-auth.service";
import { sendMetaMessage } from "@/lib/services/meta-whatsapp.service";
import { fetchMetaTemplates } from "@/lib/services/meta-template.service";
import type {
  MetaCloudConfig,
  MetaApiStatus,
  MetaTemplate,
  MetaMetrics,
  MetaMessageLog,
} from "@/lib/types/meta";

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

export async function loadMetaConfigServer(): Promise<MetaCloudConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Tenta carregar da tabela whatsapp_meta_config
  const { data: cfg } = await (supabaseAdmin as any)
    .from("whatsapp_meta_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cfg?.access_token && cfg?.phone_number_id) {
    return {
      id: cfg.id,
      access_token: cfg.access_token,
      phone_number_id: cfg.phone_number_id,
      business_account_id: cfg.business_account_id ?? "",
      app_id: cfg.app_id ?? "",
      app_secret: cfg.app_secret ?? "",
      verify_token: cfg.verify_token ?? "clinica_zoe_verify_token_2026",
      graph_version: cfg.graph_version ?? "v23.0",
    };
  }

  // 2. Fallback para notificacoes_config ou env vars
  const { data: legacy } = await (supabaseAdmin as any)
    .from("notificacoes_config")
    .select("provider_token, provider_phone_number_id, webhook_secret")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return {
    access_token: legacy?.provider_token ?? process.env.META_ACCESS_TOKEN ?? "",
    phone_number_id: legacy?.provider_phone_number_id ?? process.env.META_PHONE_NUMBER_ID ?? "",
    business_account_id: process.env.META_BUSINESS_ACCOUNT_ID ?? "",
    app_id: process.env.META_APP_ID ?? "",
    app_secret: process.env.META_APP_SECRET ?? "",
    verify_token: legacy?.webhook_secret ?? process.env.META_VERIFY_TOKEN ?? "clinica_zoe_verify_token_2026",
    graph_version: "v23.0",
  };
}

/**
 * 1. Health & Status da Meta Cloud API
 */
export const getMetaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaApiStatus> => {
    await assertAdmin(context.supabase, context.userId);
    const config = await loadMetaConfigServer();
    return validateMetaAuth(config);
  });

/**
 * 2. Obter Configurações Atuais da Meta
 */
export const getMetaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaCloudConfig> => {
    await assertAdmin(context.supabase, context.userId);
    return loadMetaConfigServer();
  });

/**
 * 3. Salvar Configurações da Meta
 */
const metaConfigSchema = z.object({
  access_token: z.string().min(10),
  phone_number_id: z.string().min(5),
  business_account_id: z.string().optional().default(""),
  app_id: z.string().optional().default(""),
  app_secret: z.string().optional().default(""),
  verify_token: z.string().optional().default("clinica_zoe_verify_token_2026"),
  graph_version: z.string().optional().default("v23.0"),
});

export const saveMetaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => metaConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Salva em whatsapp_meta_config
    const { data: existing } = await (supabaseAdmin as any)
      .from("whatsapp_meta_config")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await (supabaseAdmin as any)
        .from("whatsapp_meta_config")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await (supabaseAdmin as any).from("whatsapp_meta_config").insert(data);
    }

    // Atualiza notificacoes_config para manter compatibilidade com motor de notificações
    const { data: notifCfg } = await (supabaseAdmin as any)
      .from("notificacoes_config")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const notifPayload = {
      provider: "meta",
      provider_token: data.access_token,
      provider_phone_number_id: data.phone_number_id,
      webhook_secret: data.verify_token,
    };

    if (notifCfg?.id) {
      await (supabaseAdmin as any)
        .from("notificacoes_config")
        .update(notifPayload)
        .eq("id", notifCfg.id);
    } else {
      await (supabaseAdmin as any).from("notificacoes_config").insert(notifPayload);
    }

    return { ok: true };
  });

/**
 * 4. Enviar Mensagem de Teste via Meta Cloud API
 */
export const sendMetaTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { to: string; message: string }) =>
    z.object({ to: z.string().min(8), message: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const config = await loadMetaConfigServer();
    const result = await sendMetaMessage(config, {
      to: data.to,
      type: "text",
      text: data.message,
    });
    return result;
  });

/**
 * 5. Listar Templates Oficiais da Meta
 */
export const fetchMetaTemplatesList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaTemplate[]> => {
    await assertAdmin(context.supabase, context.userId);
    const config = await loadMetaConfigServer();
    const remote = await fetchMetaTemplates(config);
    if (remote.length > 0) return remote;

    // Fallback: templates padrão cadastrados no banco
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("whatsapp_templates").select("*");
    return (data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      language: t.language ?? "pt_BR",
      category: t.category ?? "UTILITY",
      status: t.status ?? "APPROVED",
    }));
  });

/**
 * 6. Enviar Template de Teste
 */
export const sendMetaTemplateTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { to: string; templateName: string; language?: string }) =>
    z
      .object({
        to: z.string().min(8),
        templateName: z.string().min(1),
        language: z.string().optional().default("pt_BR"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const config = await loadMetaConfigServer();
    const result = await sendMetaMessage(config, {
      to: data.to,
      type: "template",
      templateName: data.templateName,
      templateLanguage: data.language,
    });
    return result;
  });

/**
 * 7. Monitoramento de Métricas
 */
export const getMetaMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaMetrics> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await (supabaseAdmin as any)
      .from("notificacoes")
      .select("status_envio, duracao_ms, enviado_em, mensagem_recebida")
      .eq("canal", "WHATSAPP")
      .order("created_at", { ascending: false })
      .limit(1000);

    const notifs = rows ?? [];
    let enviadas = 0;
    let entregues = 0;
    let lidas = 0;
    let recebidas = 0;
    let falhas = 0;
    let somaMs = 0;
    let msCount = 0;
    let ultimoEnvio: string | null = null;

    for (const r of notifs) {
      if (r.status_envio === "ENVIADA") enviadas++;
      else if (r.status_envio === "ENTREGUE") { enviadas++; entregues++; }
      else if (r.status_envio === "LIDO") { enviadas++; entregues++; lidas++; }
      else if (r.status_envio === "RESPONDIDO") { enviadas++; entregues++; lidas++; recebidas++; }
      else if (r.status_envio === "ERRO") falhas++;

      if (r.mensagem_recebida) recebidas++;

      if (typeof r.duracao_ms === "number" && r.duracao_ms > 0) {
        somaMs += r.duracao_ms;
        msCount++;
      }

      if (r.enviado_em && (!ultimoEnvio || new Date(r.enviado_em) > new Date(ultimoEnvio))) {
        ultimoEnvio = r.enviado_em;
      }
    }

    return {
      total: notifs.length,
      enviadas,
      entregues,
      lidas,
      recebidas,
      falhas,
      tempoMedioMs: msCount > 0 ? Math.round(somaMs / msCount) : 0,
      ultimoEnvio,
    };
  });

/**
 * 8. Obter Histórico Completo de Logs da Meta
 */
export const getMetaLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { limit?: number; search?: string }) =>
    z.object({ limit: z.number().optional().default(100), search: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MetaMessageLog[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = (supabaseAdmin as any)
      .from("notificacoes")
      .select("*, agendamentos(pacientes(nome), profissionais(nome))")
      .eq("canal", "WHATSAPP")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.search) {
      const q = `%${data.search}%`;
      query = query.or(`mensagem.ilike.${q},destinatario_telefone.ilike.${q},titulo.ilike.${q}`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      destinatario_telefone: r.destinatario_telefone ?? "—",
      paciente_nome: r.agendamentos?.pacientes?.nome ?? null,
      profissional_nome: r.agendamentos?.profissionais?.nome ?? null,
      mensagem: r.mensagem,
      mensagem_recebida: r.mensagem_recebida ?? null,
      template_name: r.evento ?? "text_message",
      status_envio: r.status_envio,
      wamid: r.provider_message_id ?? null,
      duracao_ms: r.duracao_ms ?? null,
      ultimo_erro: r.ultimo_erro ?? null,
      payload: { agendamento_id: r.agendamento_id, canal: r.canal },
    }));
  });
