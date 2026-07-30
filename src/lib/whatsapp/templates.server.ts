/**
 * Gerenciamento profissional de templates da Meta WhatsApp Cloud API.
 * Server-only: sincronização, criação, exclusão, mapeamento por evento e envio inteligente.
 */

import { loadWhatsAppConfig, sendRawCloudApiMessage, isSessionOpen, lastInboundAt, GRAPH_VERSION_DEFAULT } from "@/services/whatsapp/cloudApi";
import type { CloudApiSendResult } from "@/services/whatsapp/cloudApi";
import { validateAndFormatPhone } from "@/services/whatsapp/validator";
import { buildTemplateComponents, extractPlaceholders, toPositionalBody, renderVariables, type VariableValues } from "@/services/whatsapp/variables";

export interface TemplateRow {
  id: string;
  meta_id: string | null;
  name: string;
  language: string;
  category: string;
  titulo_interno: string | null;
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: any[];
  variaveis: string[];
  status: string;
  quality_rating: string | null;
  rejected_reason: string | null;
  meta_created_at: string | null;
  meta_updated_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoTemplateRow {
  id: string;
  evento: string;
  template_name: string | null;
  language: string;
  variaveis: string[];
  ativo: boolean;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function graphBase(version?: string) {
  return `https://graph.facebook.com/${version || GRAPH_VERSION_DEFAULT}`;
}

function componentText(components: any[] | undefined, type: string): string | null {
  const c = (components ?? []).find((x: any) => String(x.type).toUpperCase() === type);
  return c?.text ?? null;
}

/** ETAPA 2 — Sincroniza a lista completa de templates da Meta para o banco local. */
export async function syncTemplatesFromMeta(): Promise<{ ok: boolean; total: number; error?: string }> {
  const cfg = await loadWhatsAppConfig();
  if (!cfg.access_token || !cfg.business_account_id) {
    return { ok: false, total: 0, error: "Access Token ou WABA ID (Business Account ID) não configurados." };
  }

  const url = `${graphBase(cfg.graph_version)}/${cfg.business_account_id}/message_templates?limit=200&fields=id,name,status,category,language,quality_score,rejected_reason,components`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${cfg.access_token}` } });
  const json: any = await resp.json().catch(() => null);

  if (!resp.ok || !Array.isArray(json?.data)) {
    return { ok: false, total: 0, error: json?.error?.message ?? `HTTP ${resp.status} ao listar templates.` };
  }

  const db = await admin();
  const now = new Date().toISOString();
  let total = 0;

  for (const t of json.data) {
    const body = componentText(t.components, "BODY") ?? "";
    const row = {
      meta_id: t.id ?? null,
      name: t.name,
      language: t.language ?? "pt_BR",
      category: t.category ?? "UTILITY",
      header_text: componentText(t.components, "HEADER"),
      body_text: body,
      footer_text: componentText(t.components, "FOOTER"),
      buttons: (t.components ?? []).find((c: any) => String(c.type).toUpperCase() === "BUTTONS")?.buttons ?? [],
      variaveis: extractPlaceholders(body),
      status: t.status ?? "PENDING",
      quality_rating: t.quality_score?.score ?? null,
      rejected_reason: t.rejected_reason ?? null,
      synced_at: now,
    };
    const { error } = await db.from("whatsapp_templates").upsert(row, { onConflict: "name,language" });
    if (!error) total++;
  }

  return { ok: true, total };
}

/** Lista os templates locais (já sincronizados com a Meta). */
export async function listLocalTemplates(): Promise<TemplateRow[]> {
  const db = await admin();
  const { data } = await db.from("whatsapp_templates").select("*").order("name");
  return (data ?? []) as TemplateRow[];
}

export interface CreateTemplateInput {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  titulo_interno?: string;
  header_text?: string;
  body_text: string;
  footer_text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  exemplos?: string[];
}

/** ETAPA 3 — Cria o template na Meta e registra localmente. */
export async function createTemplateOnMeta(
  input: CreateTemplateInput,
): Promise<{ ok: boolean; metaId?: string; status?: string; error?: string; raw?: any }> {
  const cfg = await loadWhatsAppConfig();
  if (!cfg.access_token || !cfg.business_account_id) {
    return { ok: false, error: "Access Token ou WABA ID (Business Account ID) não configurados." };
  }

  const { body, ordem } = toPositionalBody(input.body_text);
  const components: any[] = [];

  if (input.header_text?.trim()) {
    components.push({ type: "HEADER", format: "TEXT", text: input.header_text.trim() });
  }

  const bodyComponent: any = { type: "BODY", text: body };
  if (ordem.length > 0) {
    const exemplos = ordem.map((nome, i) => input.exemplos?.[i]?.trim() || nome);
    bodyComponent.example = { body_text: [exemplos] };
  }
  components.push(bodyComponent);

  if (input.footer_text?.trim()) components.push({ type: "FOOTER", text: input.footer_text.trim() });
  if (input.buttons && input.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map((b) => ({
        type: b.type || "QUICK_REPLY",
        text: b.text,
        ...(b.url ? { url: b.url } : {}),
        ...(b.phone_number ? { phone_number: b.phone_number } : {}),
      })),
    });
  }

  const payload = {
    name: input.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    language: input.language,
    category: input.category,
    components,
  };

  const resp = await fetch(`${graphBase(cfg.graph_version)}/${cfg.business_account_id}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json: any = await resp.json().catch(() => null);

  const db = await admin();
  await db.from("whatsapp_templates").upsert(
    {
      meta_id: json?.id ?? null,
      name: payload.name,
      language: payload.language,
      category: payload.category,
      titulo_interno: input.titulo_interno ?? null,
      header_text: input.header_text ?? null,
      body_text: input.body_text,
      footer_text: input.footer_text ?? null,
      buttons: input.buttons ?? [],
      variaveis: ordem,
      status: resp.ok ? (json?.status ?? "PENDING") : "REJECTED",
      rejected_reason: resp.ok ? null : (json?.error?.message ?? null),
      synced_at: new Date().toISOString(),
    },
    { onConflict: "name,language" },
  );

  if (!resp.ok) {
    return { ok: false, error: json?.error?.error_user_msg || json?.error?.message || `HTTP ${resp.status}`, raw: json };
  }
  return { ok: true, metaId: json?.id, status: json?.status ?? "PENDING", raw: json };
}

/** Exclui o template na Meta e localmente. */
export async function deleteTemplate(name: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await loadWhatsAppConfig();
  const db = await admin();

  if (cfg.access_token && cfg.business_account_id) {
    await fetch(
      `${graphBase(cfg.graph_version)}/${cfg.business_account_id}/message_templates?name=${encodeURIComponent(name)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${cfg.access_token}` } },
    ).catch(() => null);
  }

  const { error } = await db.from("whatsapp_templates").delete().eq("name", name);
  return { ok: !error, error: error?.message };
}

/** ETAPA 4 — Mapeamento evento -> template. */
export async function listEventTemplates(): Promise<EventoTemplateRow[]> {
  const db = await admin();
  const { data } = await db.from("whatsapp_evento_templates").select("*").order("evento");
  return (data ?? []) as EventoTemplateRow[];
}

export async function saveEventTemplate(input: {
  evento: string;
  template_name: string | null;
  language?: string;
  variaveis?: string[];
  ativo?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const db = await admin();
  const { error } = await db.from("whatsapp_evento_templates").upsert(
    {
      evento: input.evento,
      template_name: input.template_name,
      language: input.language ?? "pt_BR",
      ...(input.variaveis ? { variaveis: input.variaveis } : {}),
      ativo: input.ativo ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "evento" },
  );
  return { ok: !error, error: error?.message };
}

/**
 * ETAPA 6 — Envio inteligente por evento.
 * Janela de 24h aberta -> texto livre. Fechada -> template APPROVED mapeado no evento.
 * Sem template compatível, falha explicitamente (nunca envia mensagem que não será entregue).
 */
export async function sendEventMessage(params: {
  evento: string;
  to: string;
  texto: string;
  variaveis?: VariableValues;
  agendamentoId?: string;
  pacienteNome?: string;
  profissionalNome?: string;
  forcarTemplate?: boolean;
}): Promise<CloudApiSendResult & { motivo?: string }> {
  const validation = validateAndFormatPhone(params.to);
  const phone = validation.valid ? validation.formattedPhone : params.to;
  const valores = params.variaveis ?? {};

  const janelaAberta = await isSessionOpen(phone);

  if (janelaAberta && !params.forcarTemplate) {
    const { texto, faltando } = renderVariables(params.texto, valores);
    if (faltando.length > 0) {
      return {
        ok: false,
        duracaoMs: 0,
        status: 400,
        formattedPhone: phone,
        error: `Variáveis sem valor: ${faltando.join(", ")}. Mensagem não enviada.`,
        motivo: "VARIAVEIS_FALTANDO",
      };
    }
    return sendRawCloudApiMessage(
      phone,
      { type: "text", text: { preview_url: true, body: texto } },
      {
        agendamentoId: params.agendamentoId,
        pacienteNome: params.pacienteNome,
        profissionalNome: params.profissionalNome,
        evento: params.evento,
      },
    );
  }

  const db = await admin();
  const { data: mapping } = await db
    .from("whatsapp_evento_templates")
    .select("*")
    .eq("evento", params.evento)
    .maybeSingle();

  if (!mapping?.template_name || mapping.ativo === false) {
    return {
      ok: false,
      duracaoMs: 0,
      status: 400,
      formattedPhone: phone,
      error: `A janela de 24h está fechada para ${phone} e o evento "${params.evento}" não possui template aprovado configurado. Configure em Painel → WhatsApp → Eventos.`,
      motivo: "SEM_TEMPLATE_MAPEADO",
    };
  }

  const { data: tpl } = await db
    .from("whatsapp_templates")
    .select("*")
    .eq("name", mapping.template_name)
    .eq("language", mapping.language)
    .maybeSingle();

  if (!tpl || tpl.status !== "APPROVED") {
    return {
      ok: false,
      duracaoMs: 0,
      status: 400,
      formattedPhone: phone,
      error: `O template "${mapping.template_name}" (${mapping.language}) não está APROVADO na Meta (status atual: ${tpl?.status ?? "inexistente"}). Sincronize os templates ou escolha outro.`,
      motivo: "TEMPLATE_NAO_APROVADO",
    };
  }

  const ordem: string[] = Array.isArray(tpl.variaveis) && tpl.variaveis.length > 0
    ? tpl.variaveis
    : (Array.isArray(mapping.variaveis) ? mapping.variaveis : []);

  const { components, faltando } = buildTemplateComponents(
    ordem.filter((n: string) => !/^\d+$/.test(n)),
    valores,
  );

  if (faltando.length > 0) {
    return {
      ok: false,
      duracaoMs: 0,
      status: 400,
      formattedPhone: phone,
      error: `Variáveis obrigatórias sem valor para o template "${tpl.name}": ${faltando.join(", ")}.`,
      motivo: "VARIAVEIS_FALTANDO",
    };
  }

  return sendRawCloudApiMessage(
    phone,
    {
      type: "template",
      template: { name: tpl.name, language: { code: tpl.language }, components },
    },
    {
      agendamentoId: params.agendamentoId,
      pacienteNome: params.pacienteNome,
      profissionalNome: params.profissionalNome,
      templateName: tpl.name,
      evento: params.evento,
    },
  );
}

/** ETAPA 7 — Diagnóstico completo da integração. */
export interface DiagnosticoItem {
  chave: string;
  titulo: string;
  ok: boolean;
  detalhe: string;
  dados?: any;
}

export async function runFullDiagnostics(origin?: string): Promise<{
  ok: boolean;
  itens: DiagnosticoItem[];
  duracaoMs: number;
  executadoEm: string;
}> {
  const inicio = Date.now();
  const cfg = await loadWhatsAppConfig();
  const version = cfg.graph_version || GRAPH_VERSION_DEFAULT;
  const itens: DiagnosticoItem[] = [];
  const db = await admin();

  // 1. Token
  itens.push({
    chave: "token",
    titulo: "Access Token presente",
    ok: !!cfg.access_token,
    detalhe: cfg.access_token
      ? `Token com ${cfg.access_token.length} caracteres carregado do banco de configuração.`
      : "Nenhum Access Token configurado.",
  });

  // 2. Phone Number ID + Graph API
  let numero: any = null;
  if (cfg.access_token && cfg.phone_number_id) {
    const resp = await fetch(
      `${graphBase(version)}/${cfg.phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,platform_type,throughput`,
      { headers: { Authorization: `Bearer ${cfg.access_token}` } },
    );
    numero = await resp.json().catch(() => null);
    itens.push({
      chave: "phone_number_id",
      titulo: "Phone Number ID válido",
      ok: resp.ok && !numero?.error,
      detalhe: resp.ok
        ? `Número ${numero?.display_phone_number} (${numero?.verified_name}) — qualidade ${numero?.quality_rating ?? "n/d"}.`
        : (numero?.error?.message ?? `HTTP ${resp.status}`),
      dados: numero,
    });
    itens.push({
      chave: "graph_api",
      titulo: `Graph API ${version} acessível`,
      ok: resp.status !== 400 || !numero?.error?.message?.includes("version"),
      detalhe: `Endpoint de envio: POST ${graphBase(version)}/${cfg.phone_number_id}/messages`,
    });
  } else {
    itens.push({
      chave: "phone_number_id",
      titulo: "Phone Number ID válido",
      ok: false,
      detalhe: "Phone Number ID não configurado.",
    });
  }

  // 3. WABA
  let wabaData: any = null;
  if (cfg.access_token && cfg.business_account_id) {
    const resp = await fetch(
      `${graphBase(version)}/${cfg.business_account_id}?fields=id,name,timezone_id,message_template_namespace`,
      { headers: { Authorization: `Bearer ${cfg.access_token}` } },
    );
    wabaData = await resp.json().catch(() => null);
    itens.push({
      chave: "waba",
      titulo: "WhatsApp Business Account (WABA)",
      ok: resp.ok && !wabaData?.error,
      detalhe: resp.ok ? `WABA "${wabaData?.name}" (${wabaData?.id}).` : (wabaData?.error?.message ?? `HTTP ${resp.status}`),
      dados: wabaData,
    });
  } else {
    itens.push({
      chave: "waba",
      titulo: "WhatsApp Business Account (WABA)",
      ok: false,
      detalhe: "Business Account ID não configurado — sem ele não é possível listar nem criar templates.",
    });
  }

  // 4. Templates aprovados
  const { data: tpls } = await db.from("whatsapp_templates").select("name,status,language");
  const aprovados = (tpls ?? []).filter((t: any) => t.status === "APPROVED");
  itens.push({
    chave: "templates",
    titulo: "Templates aprovados disponíveis",
    ok: aprovados.length > 0,
    detalhe:
      aprovados.length > 0
        ? `${aprovados.length} template(s) APPROVED: ${aprovados.map((t: any) => `${t.name} (${t.language})`).join(", ")}.`
        : "Nenhum template APPROVED sincronizado. Fora da janela de 24h nenhuma mensagem será entregue.",
  });

  // 5. Mapeamento de eventos
  const { data: eventos } = await db.from("whatsapp_evento_templates").select("evento,template_name,ativo");
  const semTemplate = (eventos ?? []).filter((e: any) => e.ativo && !e.template_name);
  itens.push({
    chave: "eventos",
    titulo: "Eventos com template configurado",
    ok: semTemplate.length === 0,
    detalhe:
      semTemplate.length === 0
        ? `Todos os ${(eventos ?? []).length} eventos possuem template associado.`
        : `Sem template: ${semTemplate.map((e: any) => e.evento).join(", ")}.`,
  });

  // 6. Webhook — verify token e callback
  const callbackUrl = `${origin ?? ""}/api/public/hooks/meta`;
  itens.push({
    chave: "webhook_config",
    titulo: "Webhook — URL e Verify Token",
    ok: !!cfg.verify_token,
    detalhe: `Callback URL: ${callbackUrl} | Verify Token: ${cfg.verify_token ? "configurado" : "AUSENTE"}.`,
  });

  // 7. Assinatura HMAC (App Secret)
  itens.push({
    chave: "assinatura",
    titulo: "Validação de assinatura (App Secret)",
    ok: !!cfg.app_secret,
    detalhe: cfg.app_secret
      ? "App Secret configurado — assinatura X-Hub-Signature-256 será validada."
      : "App Secret ausente: os webhooks são aceitos sem validação de assinatura.",
  });

  // 8. Webhook callback realmente recebido
  const { count: inboundCount } = await db
    .from("whatsapp_message_logs")
    .select("id", { count: "exact", head: true })
    .not("mensagem_recebida", "is", null);
  const { count: statusCount } = await db
    .from("whatsapp_message_logs")
    .select("id", { count: "exact", head: true })
    .not("delivered_at", "is", null);
  itens.push({
    chave: "webhook_callback",
    titulo: "Eventos recebidos da Meta (callback)",
    ok: (inboundCount ?? 0) + (statusCount ?? 0) > 0,
    detalhe:
      (inboundCount ?? 0) + (statusCount ?? 0) > 0
        ? `${inboundCount ?? 0} mensagem(ns) recebida(s) e ${statusCount ?? 0} confirmação(ões) de entrega registradas.`
        : "Nenhum evento recebido da Meta até agora. Se as mensagens ficam em 'accepted' e nunca chegam a 'delivered', o webhook NÃO está inscrito nos campos 'messages' no app da Meta.",
  });

  // 9. Allowed List / modo do app
  const { data: errosDev } = await db
    .from("whatsapp_message_logs")
    .select("erro_codigo,ultimo_erro")
    .in("erro_codigo", ["131030", "131026", "131047"])
    .limit(5);
  itens.push({
    chave: "allowed_list",
    titulo: "Allowed List / modo do aplicativo",
    ok: !(errosDev ?? []).some((e: any) => e.erro_codigo === "131030"),
    detalhe: (errosDev ?? []).length
      ? `Erros recentes relacionados a destinatários: ${(errosDev ?? []).map((e: any) => e.erro_codigo).join(", ")}.`
      : numero?.display_phone_number?.startsWith("+1 555")
        ? "O remetente é um Test Number da Meta: só entrega para números cadastrados na Allowed List (máx. 5)."
        : "Nenhum erro de Allowed List registrado.",
  });

  // 10. Janela de conversa
  const { count: sessoes } = await db
    .from("whatsapp_sessions")
    .select("telefone", { count: "exact", head: true })
    .gte("last_inbound_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  itens.push({
    chave: "janela",
    titulo: "Janela de conversa de 24h",
    ok: true,
    detalhe: `${sessoes ?? 0} número(s) com janela aberta agora. Fora da janela, apenas templates aprovados são entregues.`,
  });

  return {
    ok: itens.every((i) => i.ok),
    itens,
    duracaoMs: Date.now() - inicio,
    executadoEm: new Date().toISOString(),
  };
}

/** Último inbound de um número (para exibição na UI). */
export async function janelaInfo(phone: string) {
  const last = await lastInboundAt(phone);
  return { ultimoInbound: last?.toISOString() ?? null, aberta: !!last && Date.now() - last.getTime() < 24 * 60 * 60 * 1000 };
}
