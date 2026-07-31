/**
 * URL pública do site, usada em canonical, OG tags e sitemap.
 * Configurável por ambiente (VITE_SITE_URL) para que o projeto continue
 * portátil ao trocar de hospedagem ou de projeto Supabase.
 */
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://clinicazoe.lovable.app"
).replace(/\/$/, "");
