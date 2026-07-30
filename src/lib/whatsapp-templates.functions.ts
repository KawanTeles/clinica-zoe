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

/** Lista os templates locais sincronizados com a Meta. */
export const listarTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { listLocalTemplates } = await import("@/lib/whatsapp/templates.server");
    return listLocalTemplates();
  });

/** Sincroniza os templates diretamente da Meta Cloud API. */
export const sincronizarTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { syncTemplatesFromMeta } = await import("@/lib/whatsapp/templates.server");
    return syncTemplatesFromMeta();
  });

const criarTemplateSchema = z.object({
  name: z.string().min(3).max(60),
  language: z.string().min(2).default("pt_BR"),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]).default("UTILITY"),
  titulo_interno: z.string().max(120).optional(),
  header_text: z.string().max(60).optional(),
  body_text: z.string().min(5).max(1024),
  footer_text: z.string().max(60).optional(),
  buttons: z
    .array(z.object({ type: z.string(), text: z.string().max(25), url: z.string().optional() }))
    .max(3)
    .optional(),
  exemplos: z.array(z.string()).max(10).optional(),
});

/** Cria um novo template na Meta (fica PENDING até aprovação). */
export const criarTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => criarTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { createTemplateOnMeta } = await import("@/lib/whatsapp/templates.server");
    return createTemplateOnMeta(data as any);
  });

/** Exclui um template na Meta e localmente. */
export const excluirTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { deleteTemplate } = await import("@/lib/whatsapp/templates.server");
    return deleteTemplate(data.name);
  });

/** Mapeamento evento do sistema -> template da Meta. */
export const listarEventosTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { listEventTemplates } = await import("@/lib/whatsapp/templates.server");
    return listEventTemplates();
  });

export const salvarEventoTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        evento: z.string().min(2),
        template_name: z.string().nullable(),
        language: z.string().optional(),
        ativo: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveEventTemplate } = await import("@/lib/whatsapp/templates.server");
    return saveEventTemplate(data);
  });

/** Diagnóstico completo (token, webhook, WABA, templates, janela, allowed list...). */
export const diagnosticarWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runFullDiagnostics } = await import("@/lib/whatsapp/templates.server");
    return runFullDiagnostics(data.origin);
  });

/** Envio de teste por evento, usando o motor inteligente (texto livre ou template). */
export const enviarPorEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        evento: z.string().min(2),
        to: z.string().min(8),
        texto: z.string().default(""),
        variaveis: z.record(z.string(), z.string()).optional(),
        forcarTemplate: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { sendEventMessage } = await import("@/lib/whatsapp/templates.server");
    const r = await sendEventMessage(data);
    return {
      ok: r.ok,
      wamid: r.wamid ?? null,
      status: r.status,
      error: r.error ?? null,
      motivo: (r as any).motivo ?? null,
      messageStatus: r.messageStatus ?? null,
      usedTemplate: r.usedTemplate ?? null,
      duracaoMs: r.duracaoMs,
      raw: r.raw ?? null,
    };
  });

/** Logs completos com o ciclo de vida de cada mensagem. */
export const listarLogsEntrega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().max(300).optional().default(100), search: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("whatsapp_message_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.search?.trim()) {
      q = q.or(
        `destinatario_telefone.ilike.%${data.search}%,paciente_nome.ilike.%${data.search}%,wamid.ilike.%${data.search}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
