import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClinicHorario = { dias: string; horario: string };
export type ClinicRedes = {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
  linkedin?: string;
};

export type ClinicSettings = {
  id?: string;
  nome: string;
  tagline: string;
  logo_url: string | null;
  hero_titulo: string;
  hero_subtitulo: string;
  hero_imagem_url: string | null;
  og_imagem_url: string | null;
  texto_institucional: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  email: string;
  horarios: ClinicHorario[];
  redes_sociais: ClinicRedes;
  latitude: number;
  longitude: number;
};

/** Valores usados enquanto as configurações não carregam (ou se ainda não existirem). */
export const CLINIC_DEFAULTS: ClinicSettings = {
  nome: "Clínica Zoe",
  tagline: "Cuidado clínico com estética premium",
  logo_url: null,
  hero_titulo: "Cuidado clínico com estética premium",
  hero_subtitulo:
    "Agende sua consulta com profissionais qualificados e acompanhe tudo pela sua área exclusiva.",
  hero_imagem_url: null,
  og_imagem_url: null,
  texto_institucional: "",
  endereco: "",
  telefone: "",
  whatsapp: "",
  email: "",
  horarios: [],
  redes_sociais: {},
  latitude: -23.5613,
  longitude: -46.6558,
};

export const CLINIC_SETTINGS_KEY = ["configuracoes-clinica"] as const;

function normalize(row: any): ClinicSettings {
  if (!row) return CLINIC_DEFAULTS;
  return {
    ...CLINIC_DEFAULTS,
    ...row,
    nome: row.nome ?? CLINIC_DEFAULTS.nome,
    tagline: row.tagline ?? CLINIC_DEFAULTS.tagline,
    hero_titulo: row.hero_titulo ?? CLINIC_DEFAULTS.hero_titulo,
    hero_subtitulo: row.hero_subtitulo ?? CLINIC_DEFAULTS.hero_subtitulo,
    texto_institucional: row.texto_institucional ?? "",
    endereco: row.endereco ?? "",
    telefone: row.telefone ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    horarios: Array.isArray(row.horarios) ? (row.horarios as ClinicHorario[]) : [],
    redes_sociais: (row.redes_sociais ?? {}) as ClinicRedes,
    latitude: row.latitude != null ? Number(row.latitude) : CLINIC_DEFAULTS.latitude,
    longitude: row.longitude != null ? Number(row.longitude) : CLINIC_DEFAULTS.longitude,
  };
}

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  const { data, error } = await (supabase as any)
    .from("configuracoes_clinica")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

/** Configurações da clínica gerenciadas no painel administrativo. */
export function useClinicSettings() {
  const { data, isLoading } = useQuery({
    queryKey: CLINIC_SETTINGS_KEY,
    queryFn: fetchClinicSettings,
    staleTime: 5 * 60 * 1000,
  });
  return { settings: data ?? CLINIC_DEFAULTS, isLoading };
}

export function whatsappHref(
  settings: Pick<ClinicSettings, "whatsapp">,
  mensagem = "Olá! Gostaria de mais informações.",
) {
  const num = (settings.whatsapp ?? "").replace(/\D/g, "");
  if (!num) return "#";
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`;
}

export function mapsEmbedUrl(settings: Pick<ClinicSettings, "latitude" | "longitude">) {
  const { latitude, longitude } = settings;
  const d = 0.005;
  const bbox = `${longitude - d}%2C${latitude - d}%2C${longitude + d}%2C${latitude + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function directionsHref(settings: Pick<ClinicSettings, "latitude" | "longitude">) {
  return `https://www.google.com/maps/dir/?api=1&destination=${settings.latitude},${settings.longitude}`;
}
