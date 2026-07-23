import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./app.agenda";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Clínica Zoe" },
      { name: "description", content: "Painel financeiro." },
      { property: "og:title", content: "Financeiro — Clínica Zoe" },
      { property: "og:description", content: "Painel financeiro." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Financeiro" desc="Consultas abertas, pagas e a receber. Chega na Etapa 6." />,
});
