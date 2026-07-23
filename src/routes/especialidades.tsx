import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/especialidades")({
  head: () => ({
    meta: [
      { title: "Especialidades — Clínica Zoe" },
      {
        name: "description",
        content: "Conheça todas as especialidades disponíveis na Clínica Zoe e agende sua consulta.",
      },
      { property: "og:title", content: "Especialidades — Clínica Zoe" },
      { property: "og:description", content: "Especialidades disponíveis para agendamento." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/especialidades" }],
  }),
  component: EspecialidadesPage,
});

function EspecialidadesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-especialidades-all"],
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
    <SiteShell>
      <section className="border-b border-border bg-gradient-to-br from-secondary via-background to-surface-muted py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Especialidades</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Cuidado especializado para você
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
              Selecione uma especialidade para conhecer os profissionais e agendar sua consulta.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {isLoading ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data?.map((e, i) => (
                <Reveal key={e.id} delay={i * 40}>
                  <div className="group h-full rounded-2xl border border-border bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elegant">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">{e.nome}</h3>
                    {e.descricao && (
                      <p className="mt-1 text-sm text-muted-foreground">{e.descricao}</p>
                    )}
                    <Link to="/agendamento" className="mt-5 inline-flex">
                      <Button size="sm" variant="outline" className="rounded-full">
                        Agendar
                      </Button>
                    </Link>
                  </div>
                </Reveal>
              ))}
              {!data?.length && (
                <p className="col-span-full text-sm text-muted-foreground">
                  Nenhuma especialidade cadastrada ainda.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
