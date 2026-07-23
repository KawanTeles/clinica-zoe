// Informações institucionais da clínica.
// Centralizadas aqui para reuso no site público (contato, rodapé, mapa).
export const CLINIC_INFO = {
  nome: "Clínica Zoe",
  tagline: "Cuidado clínico com estética premium",
  endereco: "Av. Paulista, 1000 — Bela Vista, São Paulo — SP, 01310-100",
  telefone: "+55 (11) 4000-0000",
  whatsapp: "+55 (11) 99999-0000",
  email: "contato@clinicazoe.com.br",
  horarios: [
    { dias: "Segunda a Sexta", horario: "08:00 — 20:00" },
    { dias: "Sábado", horario: "09:00 — 14:00" },
    { dias: "Domingo", horario: "Fechado" },
  ],
  // Coordenadas para o mapa (Av. Paulista como referência)
  latitude: -23.5613,
  longitude: -46.6558,
} as const;

export function whatsappHref(mensagem = "Olá! Gostaria de mais informações.") {
  const num = CLINIC_INFO.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`;
}

export function mapsEmbedUrl() {
  const { latitude, longitude } = CLINIC_INFO;
  const d = 0.005;
  const bbox = `${longitude - d}%2C${latitude - d}%2C${longitude + d}%2C${latitude + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function directionsHref() {
  const { latitude, longitude } = CLINIC_INFO;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
