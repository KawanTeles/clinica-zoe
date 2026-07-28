import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/meus-pacientes")({
  head: () => ({
    meta: [
      { title: "Meus Pacientes — Clínica" },
      { name: "description", content: "Seus pacientes." },
      { property: "og:title", content: "Meus Pacientes — Clínica" },
      { property: "og:description", content: "Seus pacientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ComingSoon title="Meus Pacientes" desc="Sua lista de pacientes chega junto com a agenda." />,
});
