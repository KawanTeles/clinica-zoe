/**
 * URL pública do site, usada em canonical, OG tags e sitemap.
 * Configurável por ambiente (VITE_SITE_URL) para que o projeto continue
 * portátil ao trocar de hospedagem ou de projeto Supabase.
 */
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? "http://localhost:8080"
).replace(/\/$/, "");

/**
 * Imagem usada nas prévias sociais (og:image / twitter:image).
 * Configurável por VITE_OG_IMAGE; por padrão usa /og-cover.png do próprio site.
 */
export const OG_IMAGE =
  (import.meta.env.VITE_OG_IMAGE as string | undefined) ?? `${SITE_URL}/og-cover.png`;
