import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { useClinicSettings, directionsHref, mapsEmbedUrl } from "@/lib/clinic-settings";
import { MapPin, Phone, Mail, Clock, Navigation } from "lucide-react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Clínica" },
      {
        name: "description",
        content: "Fale com a Clínica: endereço, telefone, e-mail e horário de funcionamento.",
      },
      { property: "og:title", content: "Contato — Clínica" },
      { property: "og:description", content: "Endereço, telefone e horário de funcionamento." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/contato" }],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const { settings } = useClinicSettings();
  return (
    <SiteShell>
      <section className="border-b border-border bg-linear-to-br from-secondary via-background to-surface-muted py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Contato</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Estamos por perto</h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
              Escolha o canal que preferir para falar com a Clínica.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-soft">
              <Row icon={MapPin} label="Endereço" value={settings.endereco} />
              <Row icon={Phone} label="Telefone" value={settings.telefone} />
              <Row
                icon={Mail}
                label="Email"
                value={settings.email}
                href={`mailto:${settings.email}`}
              />
              <div className="rounded-xl bg-secondary/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary-dark">
                  <Clock className="h-4 w-4" /> Horários
                </div>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {settings.horarios.map((h) => (
                    <li key={h.dias} className="flex justify-between">
                      <span>{h.dias}</span>
                      <span className="font-medium text-foreground">{h.horario}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <a href={directionsHref(settings)} target="_blank" rel="noreferrer">
                  <Button className="rounded-full">
                    <Navigation className="mr-2 h-4 w-4" /> Como chegar
                  </Button>
                </a>
                <Link to="/agendamento">
                  <Button variant="outline" className="rounded-full">Agendar consulta</Button>
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="overflow-hidden rounded-2xl border border-border shadow-soft">
              <iframe
                title="Localização da Clínica"
                src={mapsEmbedUrl(settings)}
                loading="lazy"
                className="h-[460px] w-full"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </SiteShell>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80">
      {content}
    </a>
  ) : (
    content
  );
}
