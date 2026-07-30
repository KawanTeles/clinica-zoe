/**
 * Meta WhatsApp Cloud API - Webhook Handler Service
 * Server-only module para processamento de Webhooks GET (verificação) e POST (eventos).
 */

import crypto from "node:crypto";
import { loadWhatsAppConfig } from "./cloudApi";

export interface ParsedMetaInboundMessage {
  type: "message" | "status";
  fromPhone?: string;
  wamid?: string;
  text?: string;
  statusText?: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  raw?: any;
}

/**
 * Validação de Assinatura HMAC-SHA256 para requisições POST do Webhook da Meta.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return true; // Se o secret não estiver definido, permite
  try {
    const expectedHash = crypto
      .createHmac("sha256", appSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    const cleanSignature = signatureHeader.replace(/^sha256=/i, "");
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(cleanSignature, "hex")
    );
  } catch (err) {
    console.error("[whatsapp:webhook] Falha ao verificar assinatura HMAC:", err);
    return false;
  }
}

/**
 * Trata o desafio GET de verificação do Webhook da Meta.
 * `hub.mode === 'subscribe'` & `hub.verify_token === WHATSAPP_VERIFY_TOKEN` => 200 hub.challenge
 */
export async function handleWebhookGet(url: URL | Request): Promise<Response> {
  const reqUrl = url instanceof Request ? new URL(url.url) : url;
  const config = await loadWhatsAppConfig();

  const mode = reqUrl.searchParams.get("hub.mode");
  const token = reqUrl.searchParams.get("hub.verify_token");
  const challenge = reqUrl.searchParams.get("hub.challenge");

  const expectedToken = config.verify_token || "clinica_zoe_verify_token_2026";

  console.log(`[whatsapp:webhook] GET Verification request. mode=${mode}, token=${token}`);

  if (mode === "subscribe" && token === expectedToken) {
    console.log("[whatsapp:webhook] Webhook verificado com sucesso!");
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[whatsapp:webhook] Falha na verificação do token do webhook.");
  return new Response("Token de verificação inválido", { status: 403 });
}

/**
 * Processa o payload do Webhook da Meta (mensagens recebidas e status).
 */
export function parseMetaWebhookBody(body: any): ParsedMetaInboundMessage[] {
  const results: ParsedMetaInboundMessage[] = [];
  if (!body || body.object !== "whatsapp_business_account") return results;

  const entries = body.entry ?? [];
  for (const entry of entries) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const value = change.value ?? {};

      // 1. Mensagens Recebidas dos usuários
      const messages = value.messages ?? [];
      for (const msg of messages) {
        const fromPhone = msg.from;
        const wamid = msg.id;
        const text =
          msg.text?.body ??
          msg.button?.text ??
          msg.interactive?.button_reply?.title ??
          msg.interactive?.list_reply?.title ??
          "";

        results.push({
          type: "message",
          fromPhone,
          wamid,
          text,
          timestamp: msg.timestamp,
          raw: msg,
        });
      }

      // 2. Statuses de Mensagens (sent, delivered, read, failed)
      const statuses = value.statuses ?? [];
      for (const st of statuses) {
        results.push({
          type: "status",
          fromPhone: st.recipient_id,
          wamid: st.id,
          statusText: st.status,
          timestamp: st.timestamp,
          raw: st,
        });
      }
    }
  }

  return results;
}

/**
 * Trata requisições POST com eventos do Webhook.
 */
export async function handleWebhookPost(request: Request): Promise<Response> {
  const startTime = Date.now();
  const config = await loadWhatsAppConfig();
  const rawBodyText = await request.text();

  // Signature validation
  const signatureHeader = request.headers.get("x-hub-signature-256");
  if (config.app_secret && signatureHeader) {
    const isValid = verifyMetaSignature(rawBodyText, signatureHeader, config.app_secret);
    if (!isValid) {
      console.error("[whatsapp:webhook] Assinatura do webhook inválida.");
      return new Response(JSON.stringify({ ok: false, error: "Assinatura do webhook inválida" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const body = JSON.parse(rawBodyText || "{}");
    const parsedEvents = parseMetaWebhookBody(body);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const ev of parsedEvents) {
      if (ev.type === "message" && ev.fromPhone && ev.text) {
        console.log(`[whatsapp:webhook] Mensagem recebida de ${ev.fromPhone}: "${ev.text}" (wamid: ${ev.wamid})`);

        // Abre/renova a janela de atendimento de 24h da Meta para este número.
        const { registerInbound } = await import("./cloudApi");
        await registerInbound(ev.fromPhone);



        // Chama RPC para interpretar resposta do profissional (CONFIRMAR, RECUSAR, REMARCAR)
        const { data: rpcRes, error: rpcErr } = await (supabaseAdmin as any).rpc(
          "processar_resposta_meta_profissional",
          {
            _telefone_prof: ev.fromPhone,
            _resposta: ev.text,
            _wamid: ev.wamid ?? null,
          }
        );

        if (rpcErr) {
          console.error("[whatsapp:webhook] Erro RPC ao processar resposta do profissional:", rpcErr.message);
        } else if (rpcRes?.ok) {
          console.log(`[whatsapp:webhook] Ação executada via RPC: ${rpcRes.action} para agendamento ${rpcRes.agendamento_id}`);
          const { processQueue } = await import("@/lib/notifications/queue.server");
          void processQueue(10).catch((err) =>
            console.error("[whatsapp:webhook] Erro ao processar fila após resposta:", err)
          );
        }

        // Registrar mensagem recebida nos logs
        await (supabaseAdmin as any).from("whatsapp_message_logs").insert({
          destinatario_telefone: ev.fromPhone,
          mensagem_recebida: ev.text,
          status_envio: "RECEBIDO",
          wamid: ev.wamid,
          duracao_ms: Date.now() - startTime,
          payload: ev.raw,
        });
      } else if (ev.type === "status" && ev.wamid) {
        const statusUpper = (ev.statusText || "").toUpperCase();
        let targetStatus: string | null = null;

        if (statusUpper === "DELIVERED") targetStatus = "ENTREGUE";
        else if (statusUpper === "READ") targetStatus = "LIDO";
        else if (statusUpper === "FAILED") targetStatus = "ERRO";
        else if (statusUpper === "SENT") targetStatus = "ENVIADA";

        // Motivo real de falha reportado pela Meta (ex.: 131047 fora da janela de 24h).
        const falha = ev.raw?.errors?.[0];
        const falhaMsg = falha
          ? `Meta status=failed code=${falha.code} title=${falha.title ?? ""} details=${falha.error_data?.details ?? falha.message ?? ""}`
          : null;
        if (falhaMsg) console.error(`[whatsapp:webhook] Falha de entrega wamid=${ev.wamid}: ${falhaMsg}`);

        if (targetStatus) {
          console.log(`[whatsapp:webhook] Atualizando status wamid=${ev.wamid} -> ${targetStatus}`);

          await (supabaseAdmin as any)
            .from("notificacoes")
            .update({
              status_envio: targetStatus,
              ...(targetStatus === "ENTREGUE" ? { entregue_em: new Date().toISOString() } : {}),
              ...(targetStatus === "LIDO" ? { lido_em: new Date().toISOString() } : {}),
              ...(targetStatus === "ERRO"
                ? { ultimo_erro: falhaMsg ?? "Falha de entrega reportada pela Meta", definitivo: true }
                : {}),
            })
            .eq("provider_message_id", ev.wamid);

          await (supabaseAdmin as any)
            .from("whatsapp_message_logs")
            .update({
              status_envio: targetStatus,
              ...(falhaMsg ? { ultimo_erro: falhaMsg } : {}),
            })
            .eq("wamid", ev.wamid);
        }

      }
    }

    const duration = Date.now() - startTime;
    console.log(`[whatsapp:webhook] Webhook POST processado com sucesso em ${duration}ms (${parsedEvents.length} eventos).`);

    return new Response(JSON.stringify({ ok: true, eventsProcessed: parsedEvents.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp:webhook] Erro no processamento do webhook POST:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
