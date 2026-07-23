import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Clínica Zoe" },
      { name: "description", content: "Suas notificações." },
      { property: "og:title", content: "Notificações — Clínica Zoe" },
      { property: "og:description", content: "Suas notificações." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Notificações" desc="Central de avisos — chega na Etapa 7 junto com o WhatsApp." />,
});
