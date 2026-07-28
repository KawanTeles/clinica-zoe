import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Megaphone, Send, Target, Users } from "lucide-react";

export const Route = createFileRoute("/app/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Clínica" },
      { name: "description", content: "Campanhas e mensagens em massa da clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MarketingPage,
});

function MarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing & Campanhas</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de disparo de mensagens, comunicação em massa e remarketing via WhatsApp.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Campanhas Ativas</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Nenhuma campanha em execução</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Audiência Alcançada</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Pacientes engajados via WhatsApp</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Taxa de Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-muted-foreground mt-1">Retorno sobre mensagens disparadas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Módulo de Campanhas em Desenvolvimento
          </CardTitle>
          <CardDescription>
            Integração nativa com a Evolution API configurada para disparos agendados e segmented por pacientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Com a Evolution API conectada no módulo <strong>WhatsApp</strong>, este painel permitirá criar mensagens personalizadas para retorno de pacientes, lembretes de exames e avisos gerais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
