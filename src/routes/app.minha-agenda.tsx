import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AgendaView, DisponibilidadeCard } from "@/components/agenda/AgendaView";
import { Card, CardContent } from "@/components/ui/card";

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
  component: MinhaAgendaPage,
});

function MinhaAgendaPage() {
  const { loading, hasRole, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !hasRole("PROFISSIONAL")) navigate({ to: "/app" });
  }, [loading, hasRole, navigate]);

  const { data: prof, isLoading } = useQuery({
    queryKey: ["meu-profissional", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!prof) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um profissional. Peça ao administrador para vincular.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AgendaView
        title="Minha agenda"
        subtitle="Somente seus atendimentos e bloqueios."
        scopedProfissionalId={prof.id}
        allowSelectProfissional={false}
      />
      <DisponibilidadeCard profissionalId={prof.id} />
    </div>
  );
}
