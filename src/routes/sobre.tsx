import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { HeartHandshake, ShieldCheck, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Clínica Zoe" },
      {
        name: "description",
        content:
          "Conheça a história, a missão e os valores da Clínica: um espaço clínico premium dedicado ao cuidado humano e à excelência.",
      },
      { property: "og:title", content: "Sobre — Clínica Zoe" },
      { property: "og:description", content: "Nossa história, missão e valores." },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "/sobre" }],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <SiteShell>
      <section className="border-b border-border bg-linear-to-br from-secondary via-background to-surface-muted py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Sobre nós</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Uma nova experiência em cuidado clínico
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              A Clínica nasceu para reunir profissionais qualificados, tecnologia e um ambiente
              sofisticado em uma jornada de atendimento verdadeiramente humana.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-3">
          {[
            { icon: HeartHandshake, title: "Missão", desc: "Oferecer cuidado clínico de excelência com escuta ativa e acolhimento." },
            { icon: Sparkles, title: "Visão", desc: "Ser referência em experiência premium no segmento de saúde." },
            { icon: ShieldCheck, title: "Valores", desc: "Ética, transparência, segurança e respeito ao paciente." },
          ].map((b, i) => (
            <Reveal key={b.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-soft">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <b.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{b.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2">
          <Reveal>
            <div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">Cuidado que faz diferença</h2>
              <p className="mt-4 text-muted-foreground">
                Cada detalhe da nossa clínica foi pensado para você: agendamento inteligente sem filas, uma
                agenda profissional que evita conflitos e uma equipe preparada para cuidar de cada
                paciente com atenção plena.
              </p>
              <div className="mt-6">
                <Link to="/agendamento">
                  <Button className="rounded-full">Agendar consulta</Button>
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Agenda 100% online",
                "Confirmação por E-mail",
                "Profissionais qualificados",
                "Ambiente sofisticado",
                "Pagamento simplificado",
                "Área do cliente",
              ].map((t) => (
                <div
                  key={t}
                  className="rounded-2xl border border-border bg-surface p-4 text-sm shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant"
                >
                  {t}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </SiteShell>
  );
}
