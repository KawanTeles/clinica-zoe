import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./app.agenda";

export const Route = createFileRoute("/app/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações — Clínica Zoe" },
      { name: "description", content: "Solicitações de consulta." },
      { property: "og:title", content: "Solicitações — Clínica Zoe" },
      { property: "og:description", content: "Solicitações de consulta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Solicitações" desc="Aceite ou recuse solicitações — chega na Etapa 5." />,
});
