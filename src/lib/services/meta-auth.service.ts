import type { MetaCloudConfig, MetaApiStatus } from "@/lib/types/meta";

/**
 * Service de Autenticação e Validação da Meta Cloud API (Graph API v20.0+)
 */
export async function validateMetaAuth(config: MetaCloudConfig): Promise<MetaApiStatus> {
  const version = config.graph_version || "v23.0";
  const baseUrl = `https://graph.facebook.com/${version}`;
  const start = Date.now();

  if (!config.access_token || !config.phone_number_id) {
    return {
      online: false,
      tokenValid: false,
      phoneNumberConnected: false,
      webhookConnected: false,
      graphVersion: version,
      error: "Access Token e Phone Number ID são obrigatórios",
    };
  }

  try {
    const resp = await fetch(
      `${baseUrl}/${config.phone_number_id}?fields=display_phone_number,verified_name,quality_rating,status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const latencyMs = Date.now() - start;
    const raw = await resp.json().catch(() => null);

    if (!resp.ok) {
      return {
        online: false,
        tokenValid: false,
        phoneNumberConnected: false,
        webhookConnected: false,
        graphVersion: version,
        latencyMs,
        error: raw?.error?.message ?? `Erro HTTP ${resp.status} na Meta API`,
        lastSync: new Date().toISOString(),
      };
    }

    return {
      online: true,
      tokenValid: true,
      phoneNumberConnected: true,
      webhookConnected: true,
      displayPhoneNumber: raw.display_phone_number ?? undefined,
      verifiedName: raw.verified_name ?? undefined,
      qualityRating: raw.quality_rating ?? undefined,
      graphVersion: version,
      latencyMs,
      lastSync: new Date().toISOString(),
    };
  } catch (e) {
    return {
      online: false,
      tokenValid: false,
      phoneNumberConnected: false,
      webhookConnected: false,
      graphVersion: version,
      latencyMs: Date.now() - start,
      error: (e as Error).message,
      lastSync: new Date().toISOString(),
    };
  }
}
