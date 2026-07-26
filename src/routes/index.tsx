import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { CLINIC_INFO, directionsHref, mapsEmbedUrl, whatsappHref } from "@/lib/clinic-info";
import {
  Sparkles,
  ShieldCheck,
  CalendarCheck,
  HeartHandshake,
  Star,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  Navigation,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${"Clínica Zoe"} — Cuidado clínico premium` },
      {
        name: "description",
        content:
          "Clínica Zoe: agenda inteligente, profissionais qualificados e uma experiência clínica premium. Agende sua consulta em minutos.",
      },
      { property: "og:title", content: "Clínica Zoe — Painel Administrativo" },
      {
        property: "og:description",
        content: "Clínica Zoe: agenda inteligente, profissionais qualificados e uma experiência clínica premium. Agende sua consulta em minutos.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <SiteShell>
      <Hero />
      <Diferenciais />
      <EspecialidadesSection />
      <ProfissionaisSection />
      <Depoimentos />
      <FAQ />
      <Localizacao />
      <CTAFinal />
    </SiteShell>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-br from-secondary via-background to-surface-muted"
      />
      <div
        aria-hidden
        className="absolute -top-40 right-[-10%] -z-10 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 left-[-10%] -z-10 h-[420px] w-[420px] rounded-full bg-[color:var(--color-gold)]/15 blur-3xl"
      />

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24 lg:pt-32">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Atendimento humano · Estética premium
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Sua saúde merece um{" "}
            <span className="bg-linear-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent">
              cuidado premium
            </span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Agende consultas com profissionais especializados, acompanhe suas visitas e receba
            confirmações em tempo real — tudo em uma experiência clínica sofisticada.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-8 flex justify-center">
            <Link to="/agendamento">
              <Button size="lg" className="rounded-full px-8 shadow-elegant">
                Agendar consulta
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

        </Reveal>

        <Reveal delay={320}>
          <div className="mt-14 grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "+10k", v: "consultas realizadas" },
              { k: "98%", v: "satisfação" },
              { k: "24h", v: "confirmação rápida" },
              { k: "5★", v: "avaliação média" },
            ].map((s) => (
              <div
                key={s.v}
                className="rounded-2xl border border-border bg-surface/80 px-4 py-4 text-left shadow-soft backdrop-blur transition hover:shadow-elegant"
              >
                <p className="text-2xl font-bold text-primary">{s.k}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Diferenciais() {
  const items = [
    { icon: CalendarCheck, title: "Agenda inteligente", desc: "Escolha o horário livre em segundos, sem ligações." },
    { icon: ShieldCheck, title: "Segurança de dados", desc: "Seus dados protegidos com padrão hospitalar." },
    { icon: HeartHandshake, title: "Atendimento humano", desc: "Profissionais atenciosos, escuta ativa e acolhimento." },
    { icon: Sparkles, title: "Estética premium", desc: "Ambiente sofisticado, calmo e confortável." },
  ];
  return (
    <section className="border-y border-border bg-surface-muted py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Diferenciais</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Uma experiência clínica pensada em cada detalhe
            </h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 80}>
              <div className="group h-full rounded-2xl border border-border bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elegant">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <it.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{it.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function EspecialidadesSection() {
  const { data } = useQuery({
    queryKey: ["site-especialidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("especialidades")
        .select("id, nome, descricao")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Especialidades</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Cuidado especializado para cada necessidade
              </h2>
            </div>
            <Link to="/especialidades" className="text-sm font-medium text-primary hover:underline">
              Ver todas <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).slice(0, 6).map((e, i) => (
            <Reveal key={e.id} delay={i * 60}>
              <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-elegant">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary-dark">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{e.nome}</h3>
                {e.descricao && <p className="mt-1 text-sm text-muted-foreground">{e.descricao}</p>}
              </div>
            </Reveal>
          ))}
          {!data?.length && (
            <p className="col-span-full text-sm text-muted-foreground">Especialidades em breve.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ProfissionaisSection() {
  const { data } = useQuery({
    queryKey: ["site-profissionais-destaque"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profissionais_public")
        .select("id, nome, foto_url, descricao, valor_consulta_avista, especialidade:especialidades(nome)")
        .order("nome")
        .limit(4);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <section className="border-y border-border bg-surface-muted py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Time</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Profissionais em destaque
              </h2>
            </div>
            <Link to="/profissionais" className="text-sm font-medium text-primary hover:underline">
              Ver todos <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(data ?? []).map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <div className="group h-full overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:-translate-y-1 hover:shadow-elegant">
                <div className="aspect-[4/5] w-full overflow-hidden bg-secondary">
                  {p.foto_url ? (
                    <img
                      src={p.foto_url}
                      alt={p.nome}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-primary-dark/40">
                      <Sparkles className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium text-primary">
                    {(p.especialidade as any)?.nome ?? "Especialista"}
                  </p>
                  <h3 className="mt-1 truncate text-base font-semibold">{p.nome}</h3>
                  {p.valor_consulta_avista && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      A partir de{" "}
                      <span className="font-semibold text-foreground">
                        {Number(p.valor_consulta_avista).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </p>
                  )}
                  <Link to="/agendamento" className="mt-4 inline-flex">
                    <Button size="sm" variant="outline" className="rounded-full">
                      Agendar
                    </Button>
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
          {!data?.length && (
            <p className="col-span-full text-sm text-muted-foreground">
              Nenhum profissional cadastrado ainda.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Depoimentos() {
  const items = [
    {
      nome: "Camila R.",
      texto:
        "Atendimento impecável. Consegui agendar em minutos e recebi confirmação no WhatsApp. Recomendo!",
    },
    {
      nome: "Roberto S.",
      texto:
        "Ambiente sofisticado e profissionais atenciosos. A experiência é totalmente diferente do que estou acostumado.",
    },
    {
      nome: "Juliana M.",
      texto:
        "Painel online, lembretes automáticos e um cuidado real. Encontrei uma clínica de verdade.",
    },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Depoimentos</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Quem cuida com a Zoe recomenda
            </h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((d, i) => (
            <Reveal key={d.nome} delay={i * 80}>
              <figure className="h-full rounded-2xl border border-border bg-surface p-6 shadow-soft">
                <div className="flex items-center gap-1 text-[color:var(--color-gold)]">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 text-sm leading-relaxed text-foreground">
                  “{d.texto}”
                </blockquote>
                <figcaption className="mt-4 text-xs font-medium text-muted-foreground">
                  — {d.nome}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "Como faço para agendar uma consulta?",
      a: "Clique em Agendar consulta, escolha a especialidade, o profissional, o dia e o horário livre. Você receberá a confirmação após aprovação do profissional.",
    },
    {
      q: "Posso remarcar ou cancelar?",
      a: "Sim. Na Área do Cliente você acompanha, remarca ou cancela suas consultas com poucos cliques.",
    },
    {
      q: "Quais são as formas de pagamento?",
      a: "Aceitamos pagamento à vista (Pix, dinheiro) e cartão. Os valores são exibidos no momento do agendamento.",
    },
    {
      q: "Meus dados estão seguros?",
      a: "Sim. Utilizamos criptografia e políticas de acesso rigorosas para proteger suas informações.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="border-y border-border bg-surface-muted py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Perguntas frequentes
            </h2>
          </div>
        </Reveal>
        <div className="mt-10 space-y-3">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={it.q} delay={i * 60}>
                <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
                  <button
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span className="text-sm font-semibold">{it.q}</span>
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-primary transition-transform duration-300 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className={`grid overflow-hidden transition-all duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0">
                      <p className="px-6 pb-5 text-sm text-muted-foreground">{it.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Localizacao() {
  return (
    <section id="localizacao" className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Onde estamos</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Venha nos visitar</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
              <InfoRow icon={MapPin} label="Endereço" value={CLINIC_INFO.endereco} />
              <InfoRow icon={Phone} label="Telefone" value={CLINIC_INFO.telefone} />
              <InfoRow icon={Mail} label="Email" value={CLINIC_INFO.email} />
              <div className="rounded-xl bg-secondary/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary-dark">
                  <Clock className="h-4 w-4" /> Horário de funcionamento
                </div>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {CLINIC_INFO.horarios.map((h) => (
                    <li key={h.dias} className="flex justify-between">
                      <span>{h.dias}</span>
                      <span className="font-medium text-foreground">{h.horario}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <a href={directionsHref()} target="_blank" rel="noreferrer">
                  <Button className="rounded-full">
                    <Navigation className="mr-2 h-4 w-4" /> Como chegar
                  </Button>
                </a>
                <a href={whatsappHref()} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="rounded-full">WhatsApp</Button>
                </a>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="overflow-hidden rounded-2xl border border-border shadow-soft">
              <iframe
                title="Localização da Clínica Zoe"
                src={mapsEmbedUrl()}
                loading="lazy"
                className="h-[420px] w-full"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function CTAFinal() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div aria-hidden className="absolute inset-0 -z-10 bg-cta bg-cta-gradient" />
      <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-cta-foreground sm:text-4xl">
            Pronto para cuidar de você com a Zoe?
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-4 max-w-2xl text-cta-foreground/90">
            Agende sua consulta agora — leva menos de um minuto.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/agendamento">
              <Button
                size="lg"
                className="rounded-full bg-cta-foreground px-6 text-cta shadow-elegant transition-transform hover:-translate-y-0.5 hover:bg-cta-foreground/90"
              >
                Agendar consulta <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href={whatsappHref()} target="_blank" rel="noreferrer">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-cta-foreground/70 bg-transparent px-6 text-cta-foreground transition-transform hover:-translate-y-0.5 hover:bg-cta-foreground/15 hover:text-cta-foreground"
              >
                Falar no WhatsApp
              </Button>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
