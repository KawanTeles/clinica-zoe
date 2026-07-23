import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clínica Zoe" },
      { name: "description", content: "Acesse o painel administrativo da Clínica Zoe." },
      { property: "og:title", content: "Clínica Zoe" },
      { property: "og:description", content: "Acesse o painel administrativo da Clínica Zoe." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-muted to-secondary">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Clínica Zoe</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost">Entrar</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <span className="h-2 w-2 rounded-full bg-primary-light" /> Painel administrativo
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Gestão inteligente para a{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              Clínica Zoe
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Agenda, pacientes, profissionais e financeiro em um único painel elegante e seguro.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-xl px-8">
                Entrar no painel
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: CalendarCheck, title: "Agenda unificada", desc: "Visão completa por profissional, sem sobreposição de horários." },
            { icon: ShieldCheck, title: "Acesso por função", desc: "Admin, recepção, profissional — cada um vê o que precisa." },
            { icon: Sparkles, title: "Design premium", desc: "Interface elegante inspirada nas melhores clínicas do mundo." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition hover:shadow-elegant"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary-dark">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
