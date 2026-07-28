import type { MetaCloudConfig, MetaTemplate } from "@/lib/types/meta";

/**
 * Service de Gerenciamento de Templates da Meta Cloud API
 */
export async function fetchMetaTemplates(config: MetaCloudConfig): Promise<MetaTemplate[]> {
  const version = config.graph_version || "v20.0";
  const baseUrl = `https://graph.facebook.com/${version}`;
  const wabaId = config.business_account_id;

  if (!config.access_token || !wabaId) {
    return [];
  }

  try {
    const resp = await fetch(`${baseUrl}/${wabaId}/message_templates?limit=100`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const raw = await resp.json().catch(() => null);
    if (!resp.ok || !Array.isArray(raw?.data)) {
      return [];
    }

    return raw.data.map((item: any) => ({
      id: item.id,
      name: item.name,
      language: item.language,
      category: item.category,
      status: item.status,
      components: item.components,
    }));
  } catch (e) {
    console.error("[meta-template.service]", e);
    return [];
  }
}
