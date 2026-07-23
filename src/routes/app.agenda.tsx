import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AgendaView } from "@/components/agenda/AgendaView";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Clínica Zoe" },
      { name: "description", content: "Agenda geral da clínica." },
      { property: "og:title", content: "Agenda — Clínica Zoe" },
      { property: "og:description", content: "Agenda geral da clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { loading, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !hasAnyRole(["ADMIN", "RECEPCIONISTA"])) navigate({ to: "/app" });
  }, [loading, hasAnyRole, navigate]);

  return (
    <AgendaView
      title="Agenda"
      subtitle="Visualize todos os profissionais, gerencie consultas e bloqueios."
      allowSelectProfissional
    />
  );
}
