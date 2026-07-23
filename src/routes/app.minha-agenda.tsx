import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./app.agenda";

export const Route = createFileRoute("/app/minha-agenda")({
  head: () => ({
    meta: [
      { title: "Minha Agenda — Clínica Zoe" },
      { name: "description", content: "Sua agenda de atendimentos." },
      { property: "og:title", content: "Minha Agenda — Clínica Zoe" },
      { property: "og:description", content: "Sua agenda de atendimentos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Minha Agenda" desc="Sua agenda pessoal chega na Etapa 4." />,
});
