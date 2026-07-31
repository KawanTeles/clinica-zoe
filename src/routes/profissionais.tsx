import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Loader2 } from "lucide-react";
import { ProfissionalCard, useProfissionaisPublicos } from "@/lib/profissionais-public";
import { SITE_URL } from "@/lib/site-url";

export const Route = createFileRoute("/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Clínica Zoe" },
      {
        name: "description",
        content: "Conheça os profissionais da Clínica e escolha o especialista ideal para você.",
      },
      { property: "og:title", content: "Profissionais — Clínica Zoe" },
      { property: "og:description", content: "Nosso time de especialistas." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/profissionais` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/profissionais` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Profissionais — Clínica Zoe",
          url: `${SITE_URL}/profissionais`,
          description: "Time de especialistas da Clínica.",
          about: { "@type": "MedicalBusiness", name: "Clínica" },
        }),
      },
    ],
  }),

  component: ProfissionaisPublicos,
});

function ProfissionaisPublicos() {
  const { data, isLoading } = useProfissionaisPublicos();

  return (
    <SiteShell>
      <section className="border-b border-border bg-linear-to-br from-secondary via-background to-surface-muted py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Profissionais</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Nosso time de especialistas
            </h1>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {isLoading ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Carregando" />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data?.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <ProfissionalCard p={p} />
                </Reveal>
              ))}
              {!data?.length && (
                <p className="col-span-full text-sm text-muted-foreground">
                  Nenhum profissional cadastrado ainda.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
