import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./app.agenda";

export const Route = createFileRoute("/app/meus-pacientes")({
  head: () => ({
    meta: [
      { title: "Meus Pacientes — Clínica Zoe" },
      { name: "description", content: "Seus pacientes." },
      { property: "og:title", content: "Meus Pacientes — Clínica Zoe" },
      { property: "og:description", content: "Seus pacientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Meus Pacientes" desc="Sua lista de pacientes chega junto com a agenda." />,
});
